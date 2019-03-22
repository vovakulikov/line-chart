import formatDate from '../utils/format-date.js';
import hexToRGB from '../utils/hex-to-rgb.js';
import rafThrottle from '../utils/raf-throttle.js';
import ChartMap from '../chart-map/chart-map.js';
import ChartLegend from "../legend/chart-legend.js";

const LABEL_OFFSET = 60;
const TOP_OFFSET = 40;
const HORIZONTAL_LINES = 5;
const VERTICAL_LINES = 5;
const DATE_COEF = 1.68;
const LABEL_WIDTH = 70;

function calculateCanvasWidth (containerWidth, {start, end}) {
	return containerWidth / (end - start);
}

function calculateVirtualWidth(containerWidth, {start, end}) {
	return containerWidth / (end - start);
}

function getViewportOffset(canvasWidth, viewportStart) {
	return -(canvasWidth * viewportStart);
}

function getLowerBorder(minY, maxY, lowerBorder) {
	const dimension = (maxY - lowerBorder) / HORIZONTAL_LINES;
	const labels = new Array(HORIZONTAL_LINES + 1)
		.fill(0)
		.map((el, index) => dimension * index + lowerBorder);

	const firstHighLine = labels.findIndex((y) => y > minY);
	const lowerLine = labels[firstHighLine] - dimension;

	return lowerLine === lowerBorder
		? lowerBorder
		: Math.floor(getLowerBorder(minY, maxY, lowerLine))
}

class Chart {

	static getTemplate(id = 0) {
		return `
			<section class="chart" id="chart-${id}">
					<canvas
						class="chart__canvas">
					</canvas>
				</div>
				
				<div class="chart__map"></div>
				<div class="chart__legend chart-legend"></div>
			</section>
		`;
	}

	static uid = 0;

	// Config shape

	// const config = {
	// 	timeline: data.columns[0].slice(1),
	// 	datasets: [
	// 		{
	// 			values: data.columns[1].slice(1),
	// 			id: 'y0',
	// 			color: '#3DC23F'
	// 		},
	// 		{
	// 			values: data.columns[2].slice(1),
	// 			id: 'y1',
	// 			color: '#F34C44'
	// 		}
	// 	]
	// };

	constructor({ rootElement, config }) {
		this.rootElement = rootElement;
		this.config = config;
		this.timeline = this.config.timeline || [];
		this.datasets = null;

		this.canvas = null;
		this.ctx = null;
		this.mapRootElement = null;
		this.map = null;
		this.legend = null;
		this.legendRootElement = null;

		this.canvasSize = null;
		this.virtualWidth = null;
		this.offsetX = null;
		this.viewport = { start: 0.0, end: 1.0 };

		this.prevTs = null;
		this.delta = null;
		this.min = 0;
		this.max = 0;
		this.lowerBorder = 0;
		this.lastRatioY = null;
		this.lastLowerBorder = null;

		this.labelsY = {};
		this.labelsX = {};

		[this.getVerticalBorders, this.forceUpdateGVB] = rafThrottle(this.getVerticalBorders.bind(this), 250)
	}

	init() {
		this.rootElement.insertAdjacentHTML('beforeend', Chart.getTemplate(Chart.uid));
		this.currentRootElement = this.rootElement.querySelector(`#chart-${Chart.uid}`);
		this.mapRootElement = this.currentRootElement.querySelector('.chart__map');
		this.legendRootElement = this.currentRootElement.querySelector('.chart__legend');

		this.map = new ChartMap({
			rootElement: this.mapRootElement,
			config: { ...this.config, viewport: this.viewport }
		});

		this.canvas = this.currentRootElement.querySelector('canvas');
		this.ctx = this.canvas.getContext('2d');
		this.canvasSize = this.canvas.getBoundingClientRect();

		this.canvas.width = this.canvasSize.width;
		this.canvas.height = this.canvasSize.height;

		this.virtualWidth = calculateVirtualWidth(this.canvasSize.width, this.viewport);
		this.offsetX = getViewportOffset(this.virtualWidth, this.viewport.start);

		this.datasets = this.config.datasets
			.map((dataset) => ({
					...dataset,
					opacity: 1,
					targetOpacity: 1,
				})
			);

		this.map.init();
		this.map.subscribe((nextViewport) => {
			this.viewport.start = nextViewport.start;
			this.viewport.end = nextViewport.end;
		});

		this.legend = new ChartLegend(this.legendRootElement, this.config);
		this.legend.init();
		this.legend.subscribe((event) => this.toggleActiveDatasets(event));

		requestAnimationFrame((ts) => this.update(ts));
	}

	toggleActiveDatasets({ id, checked }) {
		for(let i = 0; i < this.datasets.length; i++) {
			if (this.datasets[i].id === id) {
				this.datasets[i].targetOpacity = checked ? 1 : 0;
				this.map.toggleDataset({ id, checked });
			}
		}

		this.forceUpdateGVB();
	}

	forceUpdateGVB = () => {};

	update(ts) {
		requestAnimationFrame((ts) => this.update(ts));

		const prevTs = this.prevTs || ts;
		// update prev timestamp
		this.delta = Math.min(100, ts - prevTs);
		this.virtualWidth = calculateCanvasWidth(this.canvasSize.width, this.viewport);
		this.offsetX = getViewportOffset(this.virtualWidth, this.viewport.start);
		this.prevTs = ts;

		const end = Math.round(this.viewport.end * 100) / 100;
		const start = Math.round(this.viewport.start * 100) / 100;
		const chartHeight = this.canvasSize.height - LABEL_OFFSET;

		const diff = this.timeline[this.timeline.length - 1] - this.timeline[0];
		const startTimestamp = this.timeline[0] + Math.floor(start * diff);
		const dueTimestamp = this.timeline[0] + Math.floor(end * diff);

		const k = 0.008 * this.delta;
		let activeDatasets = [];

		for(let i = 0; i < this.datasets.length; i++) {
			const diff = this.datasets[i].targetOpacity - this.datasets[i].opacity;

			this.datasets[i].opacity = Math.abs(diff) < Number.EPSILON
				? this.datasets[i].targetOpacity
				: this.datasets[i].opacity + k * diff;

			if (this.datasets[i].targetOpacity === 1) {
				activeDatasets.push(this.datasets[i]);
			}
		}

		[this.min, this.max] = this.getVerticalBorders(activeDatasets, startTimestamp, dueTimestamp);
		this.lowerBorder = activeDatasets.length > 0
			? getLowerBorder(this.min, this.max, 0)
			: this.lowerBorder;
		const ratioY = chartHeight / (this.max - this.lowerBorder);
		const ratioX = this.virtualWidth / diff;

		if (this.lastLowerBorder != null) {
			const k = 0.008 * this.delta;
			const diff = this.lowerBorder - this.lastLowerBorder;

			this.lastLowerBorder = Math.abs(diff) < Number.EPSILON
				? this.lowerBorder
				: this.lastLowerBorder + k * diff;
		} else {
			this.lastLowerBorder = this.lowerBorder;
		}

		if (this.lastRatioY != null) {
			const k = 0.008 * this.delta;
			const diff = ratioY - this.lastRatioY;

			this.lastRatioY = Math.abs(diff) < Number.EPSILON
				? ratioY
				: this.lastRatioY + k * diff;
		} else {
			this.lastRatioY = ratioY;
		}

		this.ctx.setTransform(1, 0, 0, 1, this.offsetX, 0);
		this.ctx.clearRect(0, 0, this.virtualWidth, this.canvasSize.height);

		this.drawGrid(ratioY, ratioX, this.lowerBorder);

		for (let i = 0; i < this.datasets.length; i++) {
			if (+this.datasets[i].opacity.toFixed(2) > 0) {
				this.drawChart(this.datasets[i], this.lastRatioY, ratioX);
			}
		}

		this.map.update(ts);
	}

	drawYLabels(ratioY, lowerBorder) {
		const chartHeight = this.canvasSize.height - LABEL_OFFSET;
		const offsetX = -1 * this.offsetX;
		const newMaxY = (chartHeight - TOP_OFFSET) / ratioY;
		const dimension = newMaxY / HORIZONTAL_LINES;
		const newLabelsY = new Array(6)
			.fill(0)
			.map((el, index) => ({
					targetOpacity: 1,
					opacity: 0,
					targetStrokeOpacity: 1,
					strokeOpacity: 0,
					currentValue: Math.floor((dimension * index + lowerBorder) * 1000) / 1000,
				})
			);

		const p = 0.005 * this.delta;
		const ps = 0.003 * this.delta;

		for (let key in this.labelsY) {
			this.labelsY[key].targetOpacity = 0;
			this.labelsY[key].targetStrokeOpacity = 0;

			if (+this.labelsY[key].opacity.toFixed(2) === 0) {
				delete this.labelsY[key];
			}
		}

		for (let i = 0; i < newLabelsY.length; i++) {
			const label = this.labelsY[newLabelsY[i].currentValue];

			if (label) {
				label.targetOpacity = 0.4;
				label.targetStrokeOpacity = 0.16;
			} else {
				this.labelsY[newLabelsY[i].currentValue] = newLabelsY[i];
			}
		}

		this.ctx.save();

		this.ctx.lineWidth = 0.5;
		this.ctx.font = `22px Arial`;
		this.ctx.fillStyle = 'rgba(0, 0, 0, 0.4)';

		for (let key in this.labelsY) {
			const label = this.labelsY[key];
			const y = chartHeight - (this.lastRatioY * label.currentValue) + (this.lastLowerBorder * this.lastRatioY);
			const opacityDiff = label.targetOpacity - label.opacity;
			const strokeOpacityDiff = label.targetStrokeOpacity - label.strokeOpacity;

			label.opacity += p * opacityDiff;
			label.strokeOpacity += ps * strokeOpacityDiff;

			this.ctx.save();

			this.ctx.beginPath();
			this.ctx.moveTo(0, y);
			this.ctx.lineTo(this.virtualWidth, y);
			this.ctx.fillStyle = `rgba(0,0,0, ${label.opacity})`;
			this.ctx.strokeStyle = `rgba(0, 0, 0, ${label.strokeOpacity})`;
			this.ctx.fillText(Math.floor(label.currentValue), offsetX + 10, y - 6);
			this.ctx.stroke();

			this.ctx.restore();
		}

		this.ctx.restore();
	}

	dragXLabels(ratioX) {
		const diff = this.timeline[this.timeline.length - 1] - this.timeline[0];
		const initStep = diff / VERTICAL_LINES;
		const newLabelsX = [];
		const p = 0.005 * this.delta;
		let step = initStep;
		let nextLabelDate = this.timeline[0];

		while (step > initStep * DATE_COEF * (this.viewport.end - this.viewport.start)) {
			step = step / 2;
		}

		while (nextLabelDate < this.timeline[this.timeline.length - 1]) {

			const offset = nextLabelDate === this.timeline[0]
				? 0
				: -1 * LABEL_WIDTH / 2;

			newLabelsX.push({
				text: formatDate(nextLabelDate),
				date: nextLabelDate,
				offset: offset,
				targetOpacity: 0.4,
				opacity: 0,
			});

			nextLabelDate += step;
		}

		// Add last label
		newLabelsX.push({
			text: formatDate(this.timeline[this.timeline.length - 1]),
			offset: -1 * LABEL_WIDTH,
			date: this.timeline[this.timeline.length - 1],
			targetOpacity: 0.4,
			opacity: 0,
		});

		for (let key in this.labelsX) {
			this.labelsX[key].targetOpacity = 0;
		}

		for(let i = 0; i < newLabelsX.length; i++) {
			const label = newLabelsX[i];

			if (this.labelsX[label.text]) {
				this.labelsX[label.text].targetOpacity = 0.4;
			} else {
				this.labelsX[label.text] = label;
			}
		}

		this.ctx.save();

		this.ctx.font = `22px Arial`;
		this.ctx.fillStyle = 'rgba(0, 0, 0, 0.4)';

		for(let key in this.labelsX) {
			const label = this.labelsX[key];
			const diff = label.targetOpacity - label.opacity;
			const x = (label.date - this.timeline[0]) * ratioX + label.offset;

			label.opacity += p * diff;

			this.ctx.save();

			this.ctx.beginPath();
			this.ctx.moveTo(label.x, this.canvasSize.height);

			this.ctx.fillStyle = `rgba(0,0,0, ${label.opacity})`;
			this.ctx.fillText(label.text, x, this.canvasSize.height - 20);
			this.ctx.restore();
		}

		this.ctx.restore();
	}

	drawGrid(ratioY, ratioX, lowerBorder) {
		this.dragXLabels(ratioX);
		this.drawYLabels(ratioY, lowerBorder);
	}

	drawChart(dataset, ratioY, ratioX) {
		const { color, opacity } = dataset;
		const updatedColor = hexToRGB(color, opacity);
		const chartHeight = this.canvasSize.height - LABEL_OFFSET;
		let y = chartHeight - (dataset.values[0] - this.lastLowerBorder) * ratioY;

		this.ctx.save();

		this.ctx.lineWidth = 4.0;
		this.ctx.lineJoin = 'round';
		this.ctx.beginPath();
		this.ctx.moveTo(0, y);
		this.ctx.strokeStyle = updatedColor;

		for(let i = 0; i < dataset.values.length; i++) {
			y = chartHeight - (dataset.values[i] - this.lastLowerBorder) * ratioY;

			this.ctx.lineTo((this.timeline[i] - this.timeline[0]) * ratioX, y);
		}

		this.ctx.stroke();
		this.ctx.restore();
	}

	getVerticalBorders(datasets, startDate, dueDate) {
		let minValue = Infinity;
		let maxValue = -Infinity;

		if (datasets.length === 0) {
			return [this.min, this.max];
		}

		for(let i = 0; i < datasets.length; i++) {
			const values = datasets[i].values;

			for(let j = 0; j < values.length; j++) {
				if (this.timeline[j] >= startDate && this.timeline[j] <= dueDate) {
					minValue = Math.min(minValue, values[j]);
					maxValue = Math.max(maxValue, values[j]);
				}
			}
		}

		return [Math.floor(minValue * 0.99 * 1000) / 1000, Math.floor(maxValue * 1.01 * 1000) / 1000];
	}
}

export default Chart;

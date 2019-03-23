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

	getTemplate(id = 0) {
		return `
			<section class="chart" id="chart-${id}">
				<div class="chart_canvas-wrap">
					<canvas
						class="chart__canvas canvas_for-datasets">
					</canvas>
					<canvas class="chart__canvas canvas_for-labels"></canvas>
				</div>
				
				<div class="chart__map"></div>
				<div class="chart__legend chart-legend"></div>
			</section>
		`;
	}

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

		this.datasetsCanvas = null;
		this.datasetsCtx = null;
		this.mapRootElement = null;
		this.map = null;
		this.legend = null;
		this.legendRootElement = null;

		this.canvasSize = null;
		this.virtualWidth = null;
		this.offsetX = null;
		this.viewport = { start: 0.5, end: 1.0 };

		this.prevTs = null;
		this.delta = null;
		this.min = 0;
		this.max = 0;
		this.lowerBorder = 0;
		this.lastRatioY = null;
		this.lastRatioX = null;
		this.lastLowerBorder = null;
		this.shouldRerenderDatasets = true;

		this.labelsY = {};
		this.labelsX = {};

		[this.getVerticalBorders, this.forceUpdateGVB] = rafThrottle(this.getVerticalBorders.bind(this), 250)
	}

	init() {
		this.rootElement.insertAdjacentHTML('beforeend', this.getTemplate());
		this.mapRootElement = this.rootElement.querySelector('.chart__map');
		this.legendRootElement = this.rootElement.querySelector('.chart__legend');

		this.map = new ChartMap({
			rootElement: this.mapRootElement,
			config: { ...this.config, viewport: this.viewport }
		});

		this.datasetsCanvas = this.rootElement.querySelector('.canvas_for-datasets');
		this.labelsCanvas = this.rootElement.querySelector('.canvas_for-labels');
		this.datasetsCtx = this.datasetsCanvas.getContext('2d');
		this.labelsCtx = this.labelsCanvas.getContext('2d');
		this.canvasSize = this.datasetsCanvas.getBoundingClientRect();

		this.datasetsCanvas.width = this.canvasSize.width;
		this.datasetsCanvas.height = this.canvasSize.height;
		this.labelsCanvas.width = this.canvasSize.width;
		this.labelsCanvas.height = this.canvasSize.height;

		this.virtualWidth = calculateVirtualWidth(this.canvasSize.width, this.viewport);
		this.lastRatioX = this.virtualWidth / (this.timeline[this.timeline - 1] - this.timeline[0]);
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
			this.shouldRerenderDatasets = true;
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

	forceUpdateGVB() {};

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
		let shouldRerenderDatasets = false;
		let isLowerBorderChanging = false;
		let isRatioYChanging = false;

		for(let i = 0; i < this.datasets.length; i++) {
			const diff = this.datasets[i].targetOpacity - this.datasets[i].opacity;

			// todo add optimization flag
			this.datasets[i].opacity = Math.abs(diff) < Number.EPSILON
				? this.datasets[i].targetOpacity
				: this.datasets[i].opacity + k * diff;

			shouldRerenderDatasets = !Math.abs(diff) < Number.EPSILON || shouldRerenderDatasets;

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
			const diff = this.lowerBorder - this.lastLowerBorder;

			// todo add optimization flag
			this.lastLowerBorder = Math.abs(diff) < Number.EPSILON
				? this.lowerBorder
				: this.lastLowerBorder + k * diff;
			isLowerBorderChanging = !Math.abs(diff) < Number.EPSILON;

		} else {
			this.lastLowerBorder = this.lowerBorder;
		}

		if (this.lastRatioY != null) {
			const diff = ratioY - this.lastRatioY;

			// todo add optimization flag
			this.lastRatioY = Math.abs(diff) < Number.EPSILON
				? ratioY
				: this.lastRatioY + k * diff;

			isRatioYChanging = !Math.abs(diff) < Number.EPSILON;
		} else {
			this.lastRatioY = ratioY;
		}

		this.labelsCtx.clearRect(0, 0, this.virtualWidth, this.canvasSize.height);
		this.labelsCtx.setTransform(1, 0, 0, 1, this.offsetX, 0);

		this.drawGrid(ratioY, ratioX, this.lowerBorder);

		if (shouldRerenderDatasets || this.shouldRerenderDatasets || isRatioYChanging || isLowerBorderChanging) {
			this.lastRatioX = ratioX;
			this.datasetsCtx.clearRect(0, 0, this.virtualWidth, this.canvasSize.height);
			this.datasetsCtx.setTransform(1, 0, 0, 1, this.offsetX, 0);

			for (let i = 0; i < this.datasets.length; i++) {
				if (+this.datasets[i].opacity.toFixed(2) > 0) {
					this.drawChart(this.datasets[i], this.lastRatioY, ratioX);
				}
			}

			this.shouldRerenderDatasets = false;
		} else {
			console.log('no rerender dataset!!!!')
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

		this.labelsCtx.save();

		this.labelsCtx.lineWidth = 1;
		this.labelsCtx.font = `22px Arial`;
		this.labelsCtx.fillStyle = 'rgba(0, 0, 0, 0.4)';

		for (let key in this.labelsY) {
			const label = this.labelsY[key];
			const y = chartHeight - (this.lastRatioY * label.currentValue) + (this.lastLowerBorder * this.lastRatioY);
			const opacityDiff = label.targetOpacity - label.opacity;
			const strokeOpacityDiff = label.targetStrokeOpacity - label.strokeOpacity;

			label.opacity += p * opacityDiff;
			label.strokeOpacity += ps * strokeOpacityDiff;

			this.labelsCtx.save();

			this.labelsCtx.beginPath();
			this.labelsCtx.moveTo(0, +y.toPrecision(4));
			this.labelsCtx.lineTo(this.virtualWidth, +y.toPrecision(4));
			this.labelsCtx.fillStyle = `rgba(0,0,0, ${label.opacity.toPrecision(3)})`;
			this.labelsCtx.strokeStyle = `rgba(0, 0, 0, ${label.strokeOpacity})`;
			this.labelsCtx.fillText(Math.floor(label.currentValue), offsetX + 10, y - 6);
			this.labelsCtx.stroke();

			this.labelsCtx.restore();
		}

		this.labelsCtx.restore();
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

			if (+this.labelsX[key].opacity.toFixed(2) === 0) {
				delete this.labelsX[key];
			}
		}

		for(let i = 0; i < newLabelsX.length; i++) {
			const label = newLabelsX[i];

			if (this.labelsX[label.text]) {
				this.labelsX[label.text].targetOpacity = 0.4;
			} else {
				this.labelsX[label.text] = label;
			}
		}

		this.labelsCtx.save();

		this.labelsCtx.font = `22px Arial`;
		this.labelsCtx.fillStyle = 'rgba(0, 0, 0, 0.4)';

		for(let key in this.labelsX) {
			const label = this.labelsX[key];
			const diff = label.targetOpacity - label.opacity;
			const x = (label.date - this.timeline[0]) * ratioX + label.offset;

			// todo add optimization flag
			label.opacity += p * diff;

			this.labelsCtx.save();

			this.labelsCtx.beginPath();
			this.labelsCtx.moveTo(label.x, this.canvasSize.height);

			this.labelsCtx.fillStyle = `rgba(0,0,0, ${label.opacity.toPrecision(3)})`;
			this.labelsCtx.fillText(label.text, x, this.canvasSize.height - 20);
			this.labelsCtx.restore();
		}

		this.labelsCtx.restore();
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

		this.datasetsCtx.save();

		this.datasetsCtx.lineWidth = 4.0;
		this.datasetsCtx.lineJoin = 'round';
		this.datasetsCtx.beginPath();
		this.datasetsCtx.moveTo(0, y);
		this.datasetsCtx.strokeStyle = updatedColor;

		for(let i = 0; i < dataset.values.length; i++) {
			y = chartHeight - (dataset.values[i] - this.lastLowerBorder) * ratioY;

			this.datasetsCtx.lineTo((this.timeline[i] - this.timeline[0]) * ratioX, y);
		}

		this.datasetsCtx.stroke();
		this.datasetsCtx.restore();
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

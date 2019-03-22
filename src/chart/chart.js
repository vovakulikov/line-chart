import getMinMaxRange from '../utils/get-min-max-range.js';

const LABEL_OFFSET = 60;
const TOP_OFFSET = 40;
const HORIZONTAL_LINES = 5;

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
		: Math.floor(getLowerBorder(maxY, minY, lowerLine))
}

class Chart {

	static getTemplate() {
		return `
			<section class="">
				<div>
					<canvas
						class="subscribers-chart">
					</canvas>
				</div>
				
				<div class="chart-map"></div>
				<div class="chart-legend"></div>
			</section>
		`;
	}

	// Config shape

	// const config = {
	// 	timeline: data.columns[0].slice(1),
	// 	datasets: [
	// 		{
	// 			values: data.columns[1].slice(1),
	// 			name: 'y0',
	// 			color: '#3DC23F'
	// 		},
	// 		{
	// 			values: data.columns[2].slice(1),
	// 			name: 'y1',
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
		this.legendRootElement = null;

		this.canvasSize = null;
		this.virtualWidth = null;
		this.offsetX = null;
		this.viewport = { start: 0.7, end: 1.0 };

		this.maxY = 0;
		this.minY = 0;
		this.prevTs = null;
		this.delta = null;
		this.lastRatioY = null;
		this.lastLowerBorder = null;

		this.labelsY = {};
		this.labelsX = {};

		this.getVerticalBorders = this.getVerticalBorders.bind(this);
	}

	init() {
		this.rootElement.insertAdjacentHTML('beforeend', Chart.getTemplate());
		this.mapRootElement = this.rootElement.querySelector('.chart-map');
		this.legendRootElement = this.rootElement.querySelector('.chart-legend');
		this.canvas = this.rootElement.querySelector('.chart-map__canvas');
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
	}

	update(ts) {
		const prevTs = this.prevTs || ts;
		// update prev timestamp
		this.delta = Math.min(50, ts - prevTs);
		this.prevTs = ts;

		const end = Math.round(this.viewport.end * 100) / 100;
		const start = Math.round(this.viewport.start * 100) / 100;
		const chartHeight = this.canvasSize.height - LABEL_OFFSET;

		const diff = this.timeline[this.timeline.length - 1] - this.timeline[0];
		const startTimestamp = this.timeline[0] + Math.floor(start * diff);
		const dueTimestamp = this.timeline[0] + Math.floor(end * diff);

		const k = 0.008 * this.delta;
		let activeDatasets = [];

		for(let i = 0; i < this.datasets; i++) {
			const diff = this.datasets[i].targetOpacity - this.datasets[i].opacity;

			this.datasets[i].opacity = Math.abs(diff) < Number.EPSILON
				? this.datasets[i].targetOpacity
				: this.datasets[i].opacity + k * diff;

			if (this.datasets[i].targetOpacity === 1) {
				activeDatasets.push(this.datasets[i]);
			}
		}

		const [min, max] = this.getVerticalBorders(activeDatasets, startTimestamp, dueTimestamp);
		const lowerBorder = getLowerBorder(min, max, 0);
		const ratioY = chartHeight / (max - lowerBorder);
		const ratioX = this.virtualWidth / diff;

		if (this.lastLowerBorder != null) {
			const k = 0.004 * this.delta;
			const diff = lowerBorder - this.lastLowerBorder;

			this.lastLowerBorder = Math.abs(diff) < Number.EPSILON
				? lowerBorder
				: this.lastLowerBorder + k * diff;
		} else {
			this.lastLowerBorder = lowerBorder;
		}

		if (this.lastRatioY != null) {
			const k = 0.008 * this.delta;
			const diff = ratioY - this.lastRatioY;

			this.lastRatioY =  Math.abs(diff) < Number.EPSILON
				? ratioY
				: this.lastRatioY + k * diff;
		} else {
			this.lastRatioY = ratioY;
		}

		this.drawGrid(ratioY, lowerBorder);
	}

	drawGrid(ratioY, lowerBorder) {
		const chartHeight = this.canvasSize.height - LABEL_OFFSET;
		const offsetX = -1 * this.offsetX;
		const newMaxY = (chartHeight - TOP_OFFSET) / ratioY;
		const dimension = newMaxY / HORIZONTAL_LINES;
		const newLabels = new Array(6)
			.fill()
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

		for (let i = 0; i < newLabels.length; i++) {
			const label = this.labelsY[newLabels[i].currentValue];

			if (label) {
				label.targetOpacity = 0.4;
				label.targetStrokeOpacity = 0.16;
			} else {
				this.labelsY[newLabels[i].currentValue] = newLabels[i];
			}
		}

		for (let key in this.labelsY) {
			const label = this.labelsY[key];
			const y = chartHeight - (ratioY * label.currentValue) + (lowerBorder * ratioY);
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

	}

	getVerticalBorders(datasets, startDate, dueDate) {
		let minValue = Infinity;
		let maxValue = -Infinity;

		for(let i = 0; i < datasets.length; i++) {
			const values = datasets[i].values;

			for(let j = 0; j < values.length; j++) {
				if (this.timeline[j] >= startDate && this.timeline[j] <= dueDate) {
					minValue = Math.min(minValue, values[j]);
					maxValue = Math.max(maxValue, values[j]);
				}
			}
		}

		return [minValue, maxValue];
	}
}

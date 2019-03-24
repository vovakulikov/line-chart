import formatDate from '../utils/format-date.js';
import hexToRGB from '../utils/hex-to-rgb.js';
import rafThrottle from '../utils/raf-throttle.js';
import ChartMap from '../chart-map/chart-map.js';
import ChartLegend from "../legend/chart-legend.js";
import Tooltip from '../tooltip/tooltip.js';

const LABEL_OFFSET = 40;
const TOP_OFFSET = 40;
const HORIZONTAL_LINES = 5;
const VERTICAL_LINES = 3;
const DATE_COEF = 1.68;
const CHART_PADDING = 8;
const NIGHT_MODE_BG = '#242F3E';

const PRECISION = 5e-10;
const LABELS_PRECISION = 5e-3;

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
				<div class="selected-tooltip"></div>

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

	constructor({ rootElement, config, nightModeButton }) {
		this.rootElement = rootElement;
		this.config = config;
		this.nightModeButton = nightModeButton;
		this.timeline = this.config.timeline || [];
		this.datasets = null;

		this.datasetsCanvas = null;
		this.datasetsCtx = null;
		this.mapRootElement = null;
		this.map = null;
		this.legend = null;
		this.legendRootElement = null;
        this.tooltip = null;
        this.tooltipRootElement = null;

		this.canvasSize = null;
		this.virtualWidth = null;
		this.offsetX = null;
		this.viewport = { start: 0.7, end: 1.0 };

		this.prevTs = null;
		this.delta = null;
		this.min = 0;
		this.max = 0;
		this.lowerBorder = 0;
		this.lastRatioY = null;
		this.lastRatioX = null;
		this.timelineDiff = this.timeline[this.timeline.length - 1] - this.timeline[0];
		this.lastLowerBorder = null;

		// Optimization flags
		this.shouldRerenderDatasets = true;
		this.shouldRerenderLabels = true;
		this.isYLabelsAnimating = true;
		this.isXLabelsAnimating = true;
		this.rafId = null;
		this.selectedPointIndex = null;
		this.selectedPointX = null;
		this.isNightMode = false;

		this.labelsY = {};
		this.labelsX = {};

		this.composite = false;

		[this.getVerticalBorders, this.forceUpdateGVB] = rafThrottle(this.getVerticalBorders.bind(this), 250)
	}

	init({ composite = false } = {}) {
		this.rootElement.insertAdjacentHTML('beforeend', this.getTemplate());
		this.mapRootElement = this.rootElement.querySelector('.chart__map');
		this.legendRootElement = this.rootElement.querySelector('.chart__legend');
		this.tooltipRootElement = this.rootElement.querySelector('.selected-tooltip');

		this.map = new ChartMap({
			rootElement: this.mapRootElement,
			config: { ...this.config, viewport: this.viewport },
			nightModeButton: this.nightModeButton,
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
            const tooltipX = this.getAbsoluteXCoordinate(this.selectedPointX, this.offsetX);

            this.tooltip.updateTooltipPosition(tooltipX - CHART_PADDING, this.datasetsCanvas.width);
            this.shouldRerenderDatasets = true;

            this.handleViewportChange(nextViewport);
		});

		this.legend = new ChartLegend(this.legendRootElement, this.config);
		this.legend.init();
		this.legend.subscribe((event) => {
			this.toggleActiveDatasets(event);

			const idx = this.selectedPointIndex;
			const datasets = this.datasets.filter(d => d.targetOpacity !== 0);
			this.tooltip.updateTooltipData(this.timeline[idx], this.getSelectedPointsData(datasets, idx));
		});

        this.nightModeButton.subscribe(isNightMode => {
            this.isNightMode = isNightMode;
            this.tooltipRootElement.style.backgroundColor = this.isNightMode
                ? NIGHT_MODE_BG
                : '#fff';
            this.tooltipRootElement.style.borderColor = this.isNightMode
                ? NIGHT_MODE_BG
                : '#eee';
            this.tooltipRootElement.querySelector('.selected-tooltip__header').style.color = this.isNightMode
                ? '#fff'
                : '#000';

            this.shouldRerenderDatasets = true

			if (!this.rafId) {
				this.rafId = requestAnimationFrame((ts) => this.scheduleNextFrame(ts));
			}
        });

		this.tooltip = new Tooltip(this.tooltipRootElement);
		this.tooltip.init();

        this.addEventListeners();

        this.composite = composite;

		if (!this.composite) {
			this.rafId = requestAnimationFrame((ts) => this.scheduleNextFrame(ts));
		}
	}

    handleViewportChange(nextViewport) {
        this.viewport.start = nextViewport.start;
        this.viewport.end = nextViewport.end;
        this.shouldRerenderDatasets = true;
        this.shouldRerenderLabels = true;

        if (!this.rafId) {
            this.rafId = requestAnimationFrame((ts) => this.scheduleNextFrame(ts));
        }
    }

	toggleActiveDatasets({ id, checked }) {
		for(let i = 0; i < this.datasets.length; i++) {
			if (this.datasets[i].id === id) {
				this.datasets[i].targetOpacity = checked ? 1 : 0;
				this.map.toggleDataset({ id, checked });
			}
		}

		this.shouldRerenderDatasets = true;
		this.shouldRerenderLabels = true;
		this.forceUpdateGVB();

		if (!this.rafId) {
			this.rafId = requestAnimationFrame((ts) => this.scheduleNextFrame(ts));
		}
	}

	scheduleNextFrame(ts) {
		// Experimental optimization
		if (!this.shouldRerenderDatasets && !this.shouldRerenderLabels) {
			console.log('do not render at all');
			cancelAnimationFrame(this.rafId);
			this.rafId = null;

			return;
		}

		this.rafId = requestAnimationFrame((ts) => this.scheduleNextFrame(ts));
		this.update(ts);
	}

	forceUpdateGVB() {};

	update(ts) {
		const prevTs = this.prevTs || ts;
		// update prev timestamp
		this.delta = Math.min(100, ts - prevTs);
		this.virtualWidth = calculateCanvasWidth(this.canvasSize.width, this.viewport);
		this.offsetX = getViewportOffset(this.virtualWidth, this.viewport.start);
		this.prevTs = ts;

		const end = Math.round(this.viewport.end * 100) / 100;
		const start = Math.round(this.viewport.start * 100) / 100;
		const chartHeight = this.canvasSize.height - LABEL_OFFSET;
		const startTimestamp = this.timeline[0] + Math.floor(start * this.timelineDiff);
		const dueTimestamp = this.timeline[0] + Math.floor(end * this.timelineDiff);

		const k = 0.008 * this.delta;
		let activeDatasets = [];
		let shouldRerenderDatasets = false;
		let isLowerBorderChanging = false;
		let isRatioYChanging = false;

		for(let i = 0; i < this.datasets.length; i++) {
			const diff = this.datasets[i].targetOpacity - this.datasets[i].opacity;

			this.datasets[i].opacity = Math.abs(diff) < PRECISION
				? this.datasets[i].targetOpacity
				: this.datasets[i].opacity + k * diff;

			shouldRerenderDatasets = !Math.abs(diff) < PRECISION || shouldRerenderDatasets;

			if (this.datasets[i].targetOpacity === 1) {
				activeDatasets.push(this.datasets[i]);
			}
		}

		[this.min, this.max] = this.getVerticalBorders(activeDatasets, startTimestamp, dueTimestamp);
		this.lowerBorder = activeDatasets.length > 0
			// TODO Added memoization
			? getLowerBorder(this.min, this.max, 0)
			: this.lowerBorder;
		const ratioY = chartHeight / (this.max - this.lowerBorder);
		const ratioX = this.virtualWidth / this.timelineDiff;

		if (this.lastLowerBorder != null) {
			const diff = this.lowerBorder - this.lastLowerBorder;

			this.lastLowerBorder = Math.abs(diff) < PRECISION
				? this.lowerBorder
				: this.lastLowerBorder + k * diff;
			isLowerBorderChanging = !Math.abs(diff) < PRECISION;

		} else {
			this.lastLowerBorder = this.lowerBorder;
		}

		if (this.lastRatioY != null) {
			const diff = ratioY - this.lastRatioY;

			this.lastRatioY = Math.abs(diff) < PRECISION
				? ratioY
				: this.lastRatioY + k * diff;

			isRatioYChanging = !Math.abs(diff) < PRECISION;
		} else {
			this.lastRatioY = ratioY;
		}

		if (this.shouldRerenderLabels || isLowerBorderChanging || isRatioYChanging) {
			this.labelsCtx.setTransform(1, 0, 0, 1, this.offsetX, 0);
			this.labelsCtx.clearRect(0, 0, this.virtualWidth, this.canvasSize.height);

			this.drawGrid(ratioY, ratioX, this.lowerBorder);
		} else {
			console.log('not render labels');
		}

		if (this.shouldRerenderDatasets || shouldRerenderDatasets || isRatioYChanging || isLowerBorderChanging) {
			this.lastRatioX = ratioX;

			this.datasetsCtx.setTransform(1, 0, 0, 1, this.offsetX, 0);
			this.datasetsCtx.clearRect(0, 0, this.virtualWidth, this.canvasSize.height);

			for (let i = 0; i < this.datasets.length; i++) {
				if (+this.datasets[i].opacity.toFixed(2) > 0) {
					this.drawChart(this.datasets[i], this.lastRatioY, ratioX);
				}
			}

			this.selectedPointX = (this.timeline[this.selectedPointIndex] - this.timeline[0]) * this.lastRatioX;
			this.drawSelectedVerticalLine();

			for (let i = 0; i < this.datasets.length; i++) {
				if (+this.datasets[i].opacity.toFixed(2) > 0) {
				    const dataset = this.datasets[i];

                    if (this.selectedPointIndex !== null && dataset.targetOpacity !== 0) {
                        this.drawSelectedPoint(
                            this.selectedPointX,
                            this.getRelativeY(chartHeight, dataset.values[this.selectedPointIndex], this.lastRatioY),
                            dataset.color
                        );
                    }
				}
			}



		} else {
			console.log('no rerender dataset!!!!');
		}

		this.shouldRerenderLabels = this.isXLabelsAnimating || this.isYLabelsAnimating;
		this.shouldRerenderDatasets = shouldRerenderDatasets || isRatioYChanging || isLowerBorderChanging;
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
					targetOpacity: 0.4,
					opacity: 0,
					targetStrokeOpacity: 0.08,
					strokeOpacity: 0,
					currentValue: Math.floor((dimension * index + lowerBorder) * 1000) / 1000,
				})
			);

		const p = 0.005 * this.delta;

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
				label.targetStrokeOpacity = 0.08;
			} else {
				this.labelsY[newLabelsY[i].currentValue] = newLabelsY[i];
			}
		}

		this.labelsCtx.save();

		this.labelsCtx.lineWidth = 1;
		this.labelsCtx.font = `13px Arial`;
		this.labelsCtx.fillStyle = 'rgba(0, 0, 0, 0.4)';

		let isLabelsAnimating = false;

		for (let key in this.labelsY) {
			const label = this.labelsY[key];
			const y = chartHeight - (this.lastRatioY * label.currentValue) + (this.lastLowerBorder * this.lastRatioY);
			const opacityDiff = label.targetOpacity - label.opacity;
			const strokeOpacityDiff = label.targetStrokeOpacity - label.strokeOpacity;

			label.opacity = Math.abs(opacityDiff) < LABELS_PRECISION
				? label.targetOpacity
				: label.opacity + p * opacityDiff;

			label.strokeOpacity = Math.abs(strokeOpacityDiff) < LABELS_PRECISION
				? label.targetStrokeOpacity
				: label.strokeOpacity + p * strokeOpacityDiff;

			isLabelsAnimating = !Math.abs(opacityDiff) < LABELS_PRECISION || !Math.abs(strokeOpacityDiff) < LABELS_PRECISION || isLabelsAnimating;

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
		this.isYLabelsAnimating = isLabelsAnimating;
	}

	dragXLabels(ratioX) {
		const initStep = this.timelineDiff / VERTICAL_LINES;
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
				: -0.5;

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
			offset: -1,
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

		this.labelsCtx.font = `14px Arial`;
		this.labelsCtx.fillStyle = 'rgba(0, 0, 0, 0.4)';

		let isLabelsAnimating = false;

		for(let key in this.labelsX) {
			const label = this.labelsX[key];
			const diff = label.targetOpacity - label.opacity;
			const x = (label.date - this.timeline[0]) * ratioX + label.offset * this.labelsCtx.measureText(label.text).width;

			// todo add optimization flag
			label.opacity = Math.abs(diff) < LABELS_PRECISION
				? label.targetOpacity
				: label.opacity + p * diff;

			isLabelsAnimating = !Math.abs(diff) < LABELS_PRECISION || isLabelsAnimating;
			this.labelsCtx.save();

			this.labelsCtx.beginPath();
			this.labelsCtx.moveTo(label.x, this.canvasSize.height);

			this.labelsCtx.fillStyle = `rgba(0,0,0, ${label.opacity.toPrecision(3)})`;
			this.labelsCtx.fillText(label.text, x, this.canvasSize.height - 20);
			this.labelsCtx.restore();
		}

		this.labelsCtx.restore();
		this.isXLabelsAnimating = isLabelsAnimating;
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

		this.datasetsCtx.lineWidth = 3.0;
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

	getRelativeY(chartHeight, value, ratioY) {
		return chartHeight - (value - this.lastLowerBorder) * ratioY;
	}

	drawSelectedVerticalLine() {
		this.datasetsCtx.lineWidth = 2;
		this.datasetsCtx.strokeStyle = 'rgba(0, 0, 0, 0.08)';
		this.datasetsCtx.beginPath();
		this.datasetsCtx.moveTo(this.selectedPointX, 0);
		this.datasetsCtx.lineTo(this.selectedPointX, this.canvasSize.height - LABEL_OFFSET);
		this.datasetsCtx.stroke();
	}

	drawSelectedPoint(x, y, color) {
		const r = 4.0;

		this.datasetsCtx.save();

		this.datasetsCtx.beginPath();
		this.datasetsCtx.strokeStyle = color;
		this.datasetsCtx.lineWidth = 6.0;
		this.datasetsCtx.fillStyle = this.isNightMode
			? NIGHT_MODE_BG
			: '#fff';
		this.datasetsCtx.arc(x, y, r, 0, Math.PI * 2);
		this.datasetsCtx.stroke();
		this.datasetsCtx.fill();
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

	addEventListeners() {
		this.labelsCanvas.addEventListener('touchstart', event => {
			const x = event.touches[0].clientX;
			const virtualX = this.getRelativeXCoordinate(x, this.offsetX);
			const i = Math.round(virtualX * (this.timeline.length - 1) / this.virtualWidth);
			const idx = Math.max(0, Math.min(this.timeline.length, i));
			const pointsData = this.getSelectedPointsData(this.getRenderedDatasets(), idx);

			this.selectedPointIndex = idx;
			this.selectedPointX = (this.timeline[idx] - this.timeline[0]) * this.lastRatioX;
			this.tooltip.updateTooltipData(this.timeline[idx], pointsData);

			const tooltipX = Math.floor(this.getAbsoluteXCoordinate(this.selectedPointX, this.offsetX));

			this.tooltip.updateTooltipPosition(tooltipX - CHART_PADDING, this.datasetsCanvas.width);

			this.shouldRerenderDatasets = true;

			if (!this.rafId) {
				this.rafId = requestAnimationFrame((ts) => this.scheduleNextFrame(ts));
			}

			event.preventDefault();
		});
	};

	getRenderedDatasets() {
		return this.datasets.filter(dataset => +dataset.opacity.toFixed(2) > 0);
	}

	getSelectedPointsData(datasets, idx) {
		return datasets.map(dataset => {
			return {
				color: dataset.color,
				value: dataset.values[idx],
				chartName: this.config.names[Object.keys(this.config.names).find(key => key === dataset.id)],
			}
		});
	}

	getRelativeXCoordinate(xCoord, offsetX) {
		return xCoord - offsetX - CHART_PADDING;
	}

	getAbsoluteXCoordinate(xCoord, offsetX) {
		return xCoord + offsetX + CHART_PADDING;
	}
}

export default Chart;

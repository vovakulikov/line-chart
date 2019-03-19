import {chartData} from './chart_data.js';
import {
	formatDate,
	rafThrottle,
	hexToRGB,
	getDimension,
	getLabelWidth,
	getZoomRatio,
	getViewportX,
	calculateCanvasWidth
} from './helpers.js';
import settings from "./settings.js";

// TODO: turn into a store and update with reducers
let chartViewConfig = {
	viewport: {
		start: 0.0,
		end: 0.0,
	},
	chartDisplayState: {
		y0: {
			display: true,
			opacity: 1.0,
			targetOpacity: 1.0,
			isFading: false,
			isReappearing: false,
		},
		y1: {
			display: true,
			opacity: 1.0,
			targetOpacity: 1.0,
			isFading: false,
			isReappearing: false,
		}
	},
	zoomRatio: 1,
	isNightMode: false,
	shouldUpdate: true,
	shouldAnimate: false,
};
const canvas = document.querySelector('.subscribers-chart');
const chartContainer = document.querySelector('.chart-container');

let prevTs;
let delta;
let virualWidth;
let virtualLeftTransalte;

const scrollToViewport = (canvas, containerWidth, {start, end}) => {
	// canvas.width = calculateCanvasWidth(containerWidth, {start, end});
	// canvas.style.transform = `translateX(${getViewportX(canvas.width, start)}px)`;

	virualWidth = calculateCanvasWidth(containerWidth, {start, end});
	virtualLeftTransalte = getViewportX(virualWidth, start);
};


const main = async () => {
	const data = (await getData())[1];
	const legend = document.querySelector('.chart-legend');

	const legendButtons = makeLegendButtons(data);

	legendButtons.forEach(button => {
		legend.appendChild(button);
	});

	initState(data);
	// canvas.width = calculateCanvasWidth(chartContainer.clientWidth, chartViewConfig.viewport);
	virualWidth = calculateCanvasWidth(chartContainer.clientWidth, chartViewConfig.viewport);

	addScrollingListeners(canvas, chartContainer);

	// update cycle
	const update = (ts) => {
		requestAnimationFrame(update);

		const _prevTs = prevTs || ts;
		prevTs = ts;
		delta = Math.min(100.0, ts - _prevTs);

		if (chartViewConfig.shouldUpdate) {
			// canvas.width = calculateCanvasWidth(900, chartViewConfig.viewport);
			virualWidth = calculateCanvasWidth(900, chartViewConfig.viewport);
		}

		draw(canvas, data, chartViewConfig.viewport);
	};

	// start drawing
	requestAnimationFrame(update);
	scrollToViewport(canvas, chartContainer.clientWidth, chartViewConfig.viewport);
};

// reducer
export const updateViewConfig = (start, width) => {
	const containerWidth = chartContainer.clientWidth;
	const viewportStart = start / containerWidth;
	const viewportWidth = width / containerWidth;

	chartViewConfig = {
		...chartViewConfig,
		viewport: {
			start: viewportStart,
			end: Math.min(viewportStart + viewportWidth, 1),
		},
		shouldUpdate: true,
	};
	scrollToViewport(canvas, containerWidth, chartViewConfig.viewport);
};

const addScrollingListeners = (canvas, chartContainer) => {
	// scrolling
	let isDragging = false;
	let lastX = 0;
	let offsetLeft = getViewportX(virualWidth, chartViewConfig.viewport.start);

	canvas.addEventListener('touchstart', event => {
		isDragging = true;
		lastX = event.touches[0].clientX;
		event.preventDefault();
	});

	canvas.addEventListener('touchmove', event => {
		if (isDragging) {
			const x = event.touches[0].clientX;
			const delta = x - lastX;

			lastX = x;
			offsetLeft = Math.max(-(virualWidth - chartContainer.clientWidth), Math.min(offsetLeft + delta, 0));

			// canvas.style.transform = `matrix(1, 0, 0, 1, ${offsetLeft}, 0)`;
			virtualLeftTransalte = offsetLeft;

			const viewportOffset = Math.abs(offsetLeft / virualWidth);
			const viewportWidth = chartViewConfig.viewport.end - chartViewConfig.viewport.start;

			chartViewConfig = {
				...chartViewConfig,
				viewport: {
					start: viewportOffset,
					end: Math.min(viewportOffset + viewportWidth, 1),
				},
				shouldUpdate: true,
			};
		}

		event.preventDefault();
	});

	window.addEventListener('touchend', () => {
		isDragging = false;
	});
};

const makeLegendButtons = (chartData) => {
	return Object.entries(chartData.names).map(([id, label]) => {
		const checkbox = document.createElement('input');
		checkbox.type = 'checkbox';
		checkbox.checked = true;

		checkbox.addEventListener('change', () => {
			chartViewConfig = {
				...chartViewConfig,
				chartDisplayState: {
					...chartViewConfig.chartDisplayState,
					[id]: {...chartViewConfig.chartDisplayState[id], display: !chartViewConfig.chartDisplayState[id].display},
				},
				shouldAnimate: true,
				shouldUpdate: true,
			};
		});

		return wrapLegendButton(checkbox, label, chartData.colors[id]);
	});
};

const wrapLegendButton = (checkbox, labelText, color) => {
	const button = document.createElement('label');
	const text = document.createTextNode(labelText);
	const checkboxLabel = document.createElement('span');
	const checkboxBadge = document.createElement('span');

	button.classList.add('chart-legend__button', 'legend-button');
	button.style.color = color;
	checkbox.classList.add('legend-button__checkbox-input');
	checkboxLabel.classList.add('legend-button__text');
	checkboxBadge.classList.add('legend-button__checkbox-badge');

	checkboxLabel.appendChild(text);
	button.appendChild(checkbox);
	button.appendChild(checkboxBadge);
	button.appendChild(checkboxLabel);

	return button;
};

let lastMultiplier = 0;
let lastLowerBorder = 0;
let lastLengthSet;
var [gbT, forceUpdate] = rafThrottle(getBorders, 250);

function getBorders(displayedCharts, startDate, dueDate, dates) {
	let maxPoint = Math.max(
		...displayedCharts
			.map(chart => Math.max(
				...chart.dataset
					.filter((el, index) => dates[index] >= startDate && dates[index] <= dueDate)
				)
			)
	);

	let minPoint = Math.min(
		...displayedCharts
			.map(chart => Math.min(
				...chart.dataset
					.filter((el, index) => dates[index] >= startDate && dates[index] <= dueDate)
				)
			)
	);


	return [Math.floor(minPoint * 0.99 * 1000) / 1000, Math.floor(maxPoint * 1.01 * 1000) / 1000];
}

const draw = (canvas, chartData, viewport) => {
	const ctx = canvas.getContext('2d');
	const { height } = canvas;
	const width = virualWidth;

	const end = Math.round(viewport.end * 100) / 100;
	const start = Math.round(viewport.start * 100) / 100;

	ctx.setTransform(1, 0, 0, 1, virtualLeftTransalte, 0);
	ctx.clearRect(0, 0, width, height);

	const labelsOffset = 60;
	const chartHeight = height - labelsOffset;
	const chartWidth = width;
	const xColumn = settings.data.xColumn;

	console.log(start, end)

	const dates = chartData.columns
		.find(c => c[0] === xColumn)
		.slice(1)
		.map(timestamp => new Date(timestamp));

	// calculations
	const charts = chartData.columns.filter(c => c[0] !== xColumn);
	const displayedCharts = charts
		.filter(c => chartViewConfig.chartDisplayState[c[0]].opacity.toFixed(2) > 0 || chartViewConfig.chartDisplayState[c[0]].display)
		.map((c) => {
			return {...chartViewConfig.chartDisplayState[c[0]], dataset: c.slice(1), id: c[0]};
		});

	const chartForCalculate = displayedCharts.filter((chart) => chart.display);

	const newCharts = displayedCharts.map((chart) => {
		const targetOpacity = chart.display ? 1 : 0;

		const p = 0.008 * delta;
		const diff = targetOpacity - chart.opacity;
		const opacity = Math.abs(diff) < Number.EPSILON ? targetOpacity : chart.opacity + p * diff;

		chartViewConfig.chartDisplayState[chart.id].opacity = Math.max(opacity, 0);

		return {...chart, opacity, targetOpacity};
	});

	const diff = (dates[dates.length - 1] - dates[0]);
	const startDate = +dates[0] + Math.round(start * diff);
	const dueDate = +dates[0] + Math.round(end * diff);

	if (!lastLengthSet) {
		lastLengthSet = displayedCharts.length;
	}

	if (lastLengthSet !== displayedCharts.length) {
		lastLengthSet = displayedCharts.length;
		console.log('force update', lastLengthSet.length, displayedCharts.length);
		forceUpdate();
	}

	const [minPoint, maxPoint] = gbT(chartForCalculate, new Date(startDate), new Date(dueDate), dates);

	const lowerBorder = getLowerBorder(maxPoint, minPoint, 0);

	if (!lastLowerBorder) {
		lastLowerBorder = lowerBorder;
	} else {
		const p = 0.004 * delta;
		const diff = lowerBorder - lastLowerBorder;
		lastLowerBorder = lastLowerBorder + p * diff;
		lastLowerBorder = Math.abs(diff) < Number.EPSILON ? lowerBorder : lastLowerBorder + p * diff;
	}

	const multiplier = getZoomRatio(chartHeight, maxPoint - lowerBorder);
	const zoomRatioX = chartWidth / diff;

	if (!lastMultiplier) {
		lastMultiplier = multiplier
	} else {
		const p = 0.008 * delta;
		const diff = multiplier - lastMultiplier;
		lastMultiplier = Math.abs(diff) < Number.EPSILON ? multiplier : lastMultiplier + p * diff;
	}

	// drawing
	drawGrid(ctx, {
		maxY: maxPoint,
		minY: minPoint,
		canvasWidth: width,
		canvasHeight: height,
		labelsOffset,
		dates,
		lowerBorder: lastLowerBorder,
		multiplier: lastMultiplier,
		finalMultiplier: multiplier,
		finalLowerBorder: lowerBorder,
	});

	newCharts.forEach(chart => {
		const columnId = chart.id;

		drawChart(ctx, {
			chartWidth,
			lowerBorder: lastLowerBorder,
			chartHeight,
			dates,
			dataPoints: chart.dataset,
			zoomRatioX,
			zoomRatio: lastMultiplier,
			opacity: chart.opacity,
			color: chartData.colors[columnId]
		});
	});

	chartViewConfig = {
		...chartViewConfig,
		shouldUpdate: false,
	};
};

// TODO Delete this and use just simple map
class LabelsSet {
	constructor() {
		this.entities = {};
	}

	add(entity, byKey) {
		if (!this.entities[entity[byKey]]) {
			this.entities[entity[byKey]] = entity;
		}
	}

	delete = (entity) => delete this.entities[entity.value];
	getValues = () => Object.values(this.entities);
	getKeys = () => Object.keys(this.entities);
}

const labelsY = new LabelsSet();
const labelsX = new LabelsSet();

function getLowerBorder(maxY, minY, lowerBorder) {
	const horizontalLines = 5;
	const dimension = (maxY - lowerBorder) / horizontalLines;
	const labels = new Array(6)
		.fill(0)
		.map((el, index) => dimension * index + lowerBorder);

	const firstHighLine = labels.findIndex((y) => y > minY);
	const lowerLine = labels[firstHighLine] - dimension;

	return lowerLine === lowerBorder
		? lowerBorder
		: Math.floor(getLowerBorder(maxY, minY, lowerLine))
}

const drawGrid = (ctx, {
	canvasWidth,
	canvasHeight,
	labelsOffset,
	dates,
	multiplier,
	maxY,
	minY,
	finalMultiplier,
	finalLowerBorder,
	lowerBorder,
}) => {
	// styling
	ctx.strokeStyle = settings.grid.strokeStyle;
	ctx.lineWidth = settings.grid.yLineWidth;
	ctx.font = `${settings.grid.fontSize}px ${settings.grid.font}`;
	ctx.fillStyle = settings.grid.fillStyle;

	const chartHeight = canvasHeight - labelsOffset;
	const {viewport} = chartViewConfig;
	const offsetX = canvasWidth * viewport.start;
	const horizontalLines = 5;
	const newMaxY = (chartHeight - 40) / finalMultiplier;
	const dimension = newMaxY / horizontalLines;
	const newLabels = new Array(6).fill().map((el, index) => ({
		targetOpacity: 1,
		opacity: 0,
		level: 1,
		strokeOpacity: 0,
		targetStrokeOpacity: 1,
		currentValue: Math.floor((dimension * index + finalLowerBorder) * 1000) / 1000,
		value: Math.floor(dimension * index + lowerBorder)
	}));

	const p = 0.005 * delta;
	const ps = 0.003 * delta;

	labelsY.getValues().forEach((label) => {
		label.targetOpacity = 0;
		label.targetStrokeOpacity = 0;

		if (+label.opacity.toFixed(2) === 0) {
			delete labelsY.entities[label.currentValue];
		}
	});

	var storeLabels = {};

	newLabels
		.forEach((label) => {
			if (labelsY.entities[label.currentValue]) {
				labelsY.entities[label.currentValue].targetOpacity = 0.4;
				labelsY.entities[label.currentValue].targetStrokeOpacity = 0.16;
			} else {
				labelsY.add(label, 'currentValue');
			}
		});

	var lastDrawLineValue = 0;

	labelsY.getValues().forEach((label) => {
		const height = chartHeight - (multiplier * label.currentValue) + (lowerBorder * multiplier);
		const diff = label.targetOpacity - label.opacity;
		const strokeDiff = label.targetStrokeOpacity - label.strokeOpacity;
		label.opacity += p * diff;
		label.strokeOpacity += ps * strokeDiff;

		ctx.save();

		ctx.beginPath();
		ctx.moveTo(0, height);
		ctx.lineTo(canvasWidth, height);
		ctx.fillStyle = `rgba(0,0,0, ${label.opacity})`;
		ctx.strokeStyle = `rgba(0, 0, 0, ${label.strokeOpacity})`;
		ctx.fillText(Math.floor(label.currentValue).toString(), offsetX + 10, height - 6);
		ctx.stroke();

		ctx.restore();

		storeLabels[(Math.floor(label.value))] = true;
		lastDrawLineValue = label.value;
	});

	ctx.lineWidth = settings.grid.xLineWidth;

	const diff = (dates[dates.length - 1] - dates[0]);
	const globalStep = diff / 5;
	const ratioX = canvasWidth / diff;

	const newLabelsX = [];
	let step = globalStep;

	while (step > globalStep * 1.618 * (viewport.end - viewport.start)) {
		step = step / 2;
	}

	let currentDate = +dates[0];

	do {
		const label = formatDate(currentDate);
		const labelWidth = 70;
		let offset = 0;

		if (currentDate === +dates[0]) {
			offset = 0;
		} else if (currentDate >= +dates[dates.length - 1]) {
			offset = -1 * labelWidth;
		} else {
			offset = -1 * labelWidth / 2
		}

		newLabelsX.push(
			{
				label,
				width: labelWidth,
				date: currentDate,
				offset,
				targetOpacity: 1,
				opacity: 0,
			}
		);

		currentDate += step;
	} while (currentDate < (+dates[dates.length - 1]));

	const label = formatDate(dates[dates.length - 1]);
	const labelWidth = getLabelWidth(label, settings.grid.fontSize);

	newLabelsX.push({
		label,
		width: labelWidth,
		offset: -1 * labelWidth - 2,
		date: dates[dates.length - 1],
		targetOpacity: 0.4,
		opacity: 0,
	});

	labelsX.getValues().forEach((label) => {
		label.targetOpacity = 0;

		return label;
	});

	newLabelsX.forEach((label) => {
		if (labelsX.entities[label.label]) {
			labelsX.entities[label.label].targetOpacity = 0.4;
		} else {
			labelsX.add(label, 'label');
		}
	});

	labelsX.getValues().forEach((label) => {
		const diff = label.targetOpacity - label.opacity;
		const x = (label.date - dates[0]) * ratioX + label.offset;
		label.opacity += p * diff;

		ctx.save();

		ctx.beginPath();
		ctx.moveTo(label.x, canvasHeight);

		ctx.fillStyle = `rgba(0,0,0, ${label.opacity})`;
		ctx.fillText(label.label, x, canvasHeight - 20);
		ctx.restore();
	});
};

const drawChart = (ctx, {zoomRatioX, lowerBorder, dates, opacity, chartWidth, chartHeight, dataPoints, zoomRatio, color}) => {
	// styling
	ctx.lineWidth = settings.chart.lineWidth;

	let curY = chartHeight - (dataPoints[0] - lowerBorder) * zoomRatio;
	let updatedColor = hexToRGB(color, opacity);

	// drawing
	ctx.save();
	ctx.beginPath();
	ctx.moveTo(0, curY);
	ctx.strokeStyle = updatedColor;

	for (let i = 0; i < dataPoints.length; i++) {
		curY = chartHeight - (dataPoints[i] - lowerBorder) * zoomRatio;
		ctx.lineTo((dates[i] - dates[0]) * zoomRatioX, curY);
	}

	ctx.stroke();
	ctx.restore();
};

const initState = (chartData) => {
	chartViewConfig = {
		...chartViewConfig,
		viewport: settings.initViewport,
		chartDisplayState: Object.keys(chartData.names).reduce((acc, id) => {
			acc[id] = {
				display: true,
				opacity: 1.0,
				isFading: false,
				isReappearing: false,
			};
			return acc;
		}, {}),
	};
};

const getData = async () => {
	// replace with a call to actual API
	return Promise.resolve(chartData);
};

window.onload = main;

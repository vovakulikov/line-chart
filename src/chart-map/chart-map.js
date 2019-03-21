import hexToRGB from '../utils/hex-to-rgb.js';
import getCoords from '../utils/get-coords.js';

const MIN_WIDTH_VIEWPORT = 40;

function getMaxPoint(datasets) {
	const allValues = datasets
		.reduce((values, dataset) => values.concat(dataset.values), []);

	return Math.max.apply(null, allValues);
}

function getMinPoint(datasets) {
	const allValues = Object.values(datasets)
		.reduce((values, dataset) => values.concat(dataset.values), []);

	return Math.min.apply(null, allValues);
}

class ChartMap {
	constructor({ rootElement, config }) {
		this.rootElement = rootElement;
		this.config = config;
		this.timeline = this.config.timeline || [];
		this.datasets = null; // config.datasets || {};
		this.canvas = null;
		this.sliderElement = null;
		this.leftHandElement = null;
		this.rightHandElement = null;
		this.canvasSize = null;
		this.ctx = null;
		this.ratioY = null;
		this.ratioX = null;
		this.subscribers = [];

		this.maxY = 0;
		this.minY = 0;
	}

	init() {
		this.rootElement.insertAdjacentHTML('beforeend', ChartMap.getTemplate());
		this.canvas = this.rootElement.querySelector('.chart-map__canvas');
		this.sliderElement = this.rootElement.querySelector('.chart-map__slider');
		this.leftHandElement = this.rootElement.querySelector('.chart-map__left-hand');
		this.rightHandElement = this.rootElement.querySelector('.chart-map__right-hand');
		this.ctx = this.canvas.getContext('2d');
		this.canvasSize = this.canvas.getBoundingClientRect();

		this.canvas.width = this.canvasSize.width;
		this.canvas.height = this.canvasSize.height;

		this.maxY = getMaxPoint(this.config.datasets);
		this.minY = getMinPoint(this.config.datasets);

		this.ratioY = this.canvasSize.height / (this.maxY - this.minY);
		this.ratioX = this.canvasSize.width / (this.timeline[this.timeline.length - 1] - this.timeline[0]);

		this.datasets = this.config.datasets
			.map((dataset) => ({
					...dataset,
					ratioY: this.ratioY,
					targetRatioY: this.ratioY,
					opacity: 1,
					targetOpacity: 1,
				})
			);

		this.addEventListeners();
	}

	addEventListeners() {
		this.sliderElement.addEventListener('touchstart', (event) => this.sliderTouchHandle(event));
		this.leftHandElement.addEventListener('touchstart', (event) => this.leftHandTouchHandle(event));
		this.rightHandElement.addEventListener('touchstart', (event) => this.rightHandTouchHandle(event));
	};

	sibscribe(callback) {
		this.subscribers.push(callback);
	}

	fireChangeViewportEvent() {
		this.subscribers.forEach((callback) => callback());
	}

	turnOffDataset(name) {
		var stayDatasets = [];

		for (let i = 0; i < this.datasets.length; i++) {
			if (this.datasets[i].name === name) {
				this.datasets[i].targetOpacity = 0;
			} else {
				stayDatasets.push(this.datasets[i]);
			}
		}

		this.maxY = getMaxPoint(stayDatasets);
		this.minY = getMinPoint(stayDatasets);

		const newRatioY = this.canvasSize.height / (this.maxY - this.minY);

		for (let i = 0; i < stayDatasets.length; i++) {
			stayDatasets[i].targetRatioY = newRatioY;
		}
	}

	turnOnDataset(name) {
		this.maxY = getMaxPoint(this.datasets);
		this.minY = getMinPoint(this.datasets);

		const newRatioY = this.canvasSize.height / (this.maxY - this.minY);

		for (let i = 0; i < this.datasets.length; i++) {
			if (this.datasets[i].name === name) {
				this.datasets[i].targetOpacity = 1;
				this.datasets[i].ratioY = newRatioY;
			}

			this.datasets[i].targetRatioY = newRatioY;
		}
	}

	update(ts) {
		const prevTs = this.prevTs || ts;
		const delta = Math.min(50, ts - prevTs);
		const k = 0.008 * delta;
		// update prev timestamp
		this.prevTs = ts;

		// update datasets params
		for (let i = 0; i < this.datasets.length; i++) {
			const opacityDiff = this.datasets[i].targetOpacity - this.datasets[i].opacity;
			const ratioYDiff = this.datasets[i].targetRatioY - this.datasets[i].ratioY;

			this.datasets[i].opacity = Math.abs(opacityDiff) < Number.EPSILON
				? this.datasets[i].targetOpacity
				: this.datasets[i].opacity + k * opacityDiff;

			this.datasets[i].ratioY = Math.abs(ratioYDiff) < Number.EPSILON
				? this.datasets[i].targetRatioY
				: this.datasets[i].ratioY + k * ratioYDiff;
		}

		this.ctx.clearRect(0, 0, this.canvasSize.width, this.canvasSize.height);
		this.datasets.forEach((dataset) => this.drawChart(dataset));
	}

	drawChart(dataset) {
		const { values, color = 'red', ratioY, opacity } = dataset;

		this.ctx.save();
		this.ctx.lineWidth = 2;
		this.ctx.beginPath();
		this.ctx.strokeStyle = hexToRGB(color, opacity);

		for (let i = 0; i < values.length; i++) {
			const y = this.canvasSize.height - Math.floor((values[i] - this.minY) * ratioY);
			const x = Math.floor((this.timeline[i] - this.timeline[0]) * this.ratioX);

			this.ctx.lineTo(x, y);
		}

		this.ctx.stroke();
		this.ctx.restore();
	}

	static getTemplate() {
		return `
			<div class="chart-map__wrap">
				<canvas 
					class="chart-map__canvas">
				</canvas>

				<div class="chart-map__slider">
					<div class="chart-map__hand chart-map__left-hand"></div>
					<div class="chart-map__hand chart-map__right-hand"></div>
				</div>
      </div>
		`;
	}

	sliderTouchHandle(event) {
		event = event.touches[0];

		const wrapCoords = getCoords(this.canvas);
		const coords = getCoords(event.target);
		const startX = coords.left - wrapCoords.left;
		const originEventX = event.pageX;
		const leftShift = event.pageX - coords.left;
		const rightShift = coords.right - event.pageX;

		const move = (event) => {
			event.stopImmediatePropagation();
			event = event.touches[0];

			const delta = event.pageX - originEventX;

			if ((event.pageX - leftShift) < wrapCoords.left) {
				this.sliderElement.style.transform =`translateX(${0}px)`;
				// updateViewConfig(getTranslateValue(slider.style.transform), slider.clientWidth);

				return;
			}

			if ((event.pageX + rightShift) > wrapCoords.right ){
				this.sliderElement.style.transform =`translateX(${wrapCoords.width - coords.width}px)`;
				// updateViewConfig(getTranslateValue(slider.style.transform), slider.clientWidth);

				return;
			}

			this.sliderElement.style.transform =`translateX(${startX + delta}px)`;
			// updateViewConfig(getTranslateValue(slider.style.transform), slider.clientWidth);
		};

		function cleanUp() {
			document.removeEventListener('touchmove', move);
			document.removeEventListener('touchend', cleanUp);
		}

		document.addEventListener('touchmove', move);
		document.addEventListener('touchend', cleanUp);
	}

	rightHandTouchHandle(event) {
		event.stopImmediatePropagation();
		event = event.touches[0];

		const wrapCoords = getCoords(this.canvas);
		const sliderCoords = getCoords(this.sliderElement);
		const originEventX = event.pageX;
		const originWidth = this.sliderElement.clientWidth;

		const changeWidth = (event) => {
			event.stopImmediatePropagation();
			event = event.touches[0];

			const delta = event.pageX - originEventX;
			const newWidth = originWidth + delta;

			if (newWidth < MIN_WIDTH_VIEWPORT) {
				this.sliderElement.style.width = `${MIN_WIDTH_VIEWPORT}px`;
				// updateViewConfig(getTranslateValue(slider.style.transform), slider.clientWidth);

				return;
			}

			if ((newWidth + (sliderCoords.left - wrapCoords.left)) >= (wrapCoords.right - wrapCoords.left)) {
				this.sliderElement.style.width = `${wrapCoords.right - sliderCoords.left}px`;
				// updateViewConfig(getTranslateValue(slider.style.transform), slider.clientWidth);

				return;
			}

			this.sliderElement.style.width = `${originWidth + delta}px`;
			// updateViewConfig(getTranslateValue(slider.style.transform), slider.clientWidth);
		};

		function cleanUp() {
			document.removeEventListener('touchmove', changeWidth);
			document.removeEventListener('touchend', cleanUp);
		}

		document.addEventListener('touchmove', changeWidth);
		document.addEventListener('touchend', cleanUp);
	}

	leftHandTouchHandle(event) {
		event.stopImmediatePropagation();
		event = event.touches[0];

		const wrapCoords = getCoords(this.canvas);
		const sliderCoords = getCoords(this.sliderElement);

		const startX = sliderCoords.left - wrapCoords.left;
		const originEventX = event.pageX;
		const originWidth = this.sliderElement.clientWidth;
		const leftShiftX = event.pageX - sliderCoords.left;


		const changeWidth = (event) => {
			event.stopImmediatePropagation();
			event = event.touches[0];

			const delta = event.pageX - originEventX;
			const newWidth = originWidth + -1 * delta;

			if (newWidth < MIN_WIDTH_VIEWPORT) {
				const nextOfsset = sliderCoords.right - wrapCoords.left - MIN_WIDTH_VIEWPORT;
				const nextWidth = MIN_WIDTH_VIEWPORT;

				this.sliderElement.style.width = `${nextWidth}px`;
				this.sliderElement.style.transform =`translateX(${nextOfsset}px)`;
				this.fireChangeViewportEvent(nextOfsset, nextWidth);

				return;
			}

			if ((event.pageX - leftShiftX) <= wrapCoords.left) {
				this.sliderElement.style.width = `${sliderCoords.right - wrapCoords.left}px`;
				this.sliderElement.style.transform =`translateX(0px)`;
				// updateViewConfig(getTranslateValue(slider.style.transform), slider.clientWidth);

				return;
			}

			this.sliderElement.style.transform =`translateX(${startX + delta}px)`;
			this.sliderElement.style.width = `${newWidth}px`;
			// updateViewConfig(getTranslateValue(slider.style.transform), slider.clientWidth);
		};

		function cleanUp() {
			document.removeEventListener('touchmove', changeWidth);
			document.removeEventListener('touchend', cleanUp);
		}

		document.addEventListener('touchmove', changeWidth);
		document.addEventListener('touchend', cleanUp);
	}
}

export default ChartMap;

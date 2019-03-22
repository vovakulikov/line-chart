import hexToRGB from '../utils/hex-to-rgb.js';
import getCoords from '../utils/get-coords.js';
import getMinMaxRange from '../utils/get-min-max-range.js';

const MIN_WIDTH_VIEWPORT = 40;

function getTranslateValue(transform) {
	return +transform.replace(/[^\d.]/g, '');
}

class ChartMap {

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

	// Config should has shape like object below

	// const config = {
	// 	timeline: data.columns[0].slice(1),
	//  viewport: { start: 0.7, end: 1.0 }
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
		this.viewport = this.config.viewport || {};
		this.datasets = null;
		this.canvas = null;
		this.sliderElement = null;
		this.leftHandElement = null;
		this.rightHandElement = null;
		this.canvasSize = null;
		this.ctx = null;
		this.ratioY = null;
		this.ratioX = null;
		this.prevTs = null;
		this.shouldRender = true;
		this.subscribers = [];

		this.maxY = 0;
		this.minY = 0;
	}

	init() {
		this.rootElement.insertAdjacentHTML('beforeend', ChartMap.getTemplate());
		this.canvas = this.rootElement.querySelector('.chart-map__canvas');
		this.ctx = this.canvas.getContext('2d');
		this.sliderElement = this.rootElement.querySelector('.chart-map__slider');
		this.leftHandElement = this.rootElement.querySelector('.chart-map__left-hand');
		this.rightHandElement = this.rootElement.querySelector('.chart-map__right-hand');
		this.canvasSize = this.canvas.getBoundingClientRect();

		this.canvas.width = this.canvasSize.width;
		this.canvas.height = this.canvasSize.height;

		this.sliderElement.style.width = `${(this.viewport.end - this.viewport.start) * this.canvasSize.width}px`;
		this.sliderElement.style.transform = `translateX(${this.viewport.start * this.canvasSize.width}px)`;

		[this.minY, this.maxY] = getMinMaxRange(this.config.datasets);

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

	subscribe(callback) {
		this.subscribers.push(callback);
	}

	fireChangeViewportEvent(event) {
		const { nextOffset, nextWidth } = event;
		const nextViewport = {
			start: Math.max(0, nextOffset / this.canvasSize.width),
			end: Math.min(1, (nextOffset + nextWidth) / this.canvasSize.width)
		};

		this.subscribers.forEach((callback) => callback(nextViewport));
	}

	toggleDataset({ id, checked }) {
		if (checked) {
			this.turnOnDataset(id);
		} else {
			this.turnOffDataset(id);
		}
	}

	turnOffDataset(id) {
		const stayOnDatasets = [];
		this.shouldRender = true;

		for (let i = 0; i < this.datasets.length; i++) {
			if (this.datasets[i].id === id) {
				this.datasets[i].targetOpacity = 0;
			} else {
				stayOnDatasets.push(this.datasets[i]);
			}
		}

		[this.minY, this.maxY] = getMinMaxRange(stayOnDatasets);

		const newRatioY = this.canvasSize.height / (this.maxY - this.minY);

		for (let i = 0; i < stayOnDatasets.length; i++) {
			stayOnDatasets[i].targetRatioY = newRatioY;
		}
	}

	turnOnDataset(id) {

		[this.minY, this.maxY] = getMinMaxRange(this.datasets);
		this.shouldRender = true;

		const newRatioY = this.canvasSize.height / (this.maxY - this.minY);

		for (let i = 0; i < this.datasets.length; i++) {
			if (this.datasets[i].id === id) {
				this.datasets[i].targetOpacity = 1;
				this.datasets[i].ratioY = newRatioY;
			}

			this.datasets[i].targetRatioY = newRatioY;
		}
	}

	update(ts) {
		if (!this.shouldRender) {
			return;
		}

		const prevTs = this.prevTs || ts;
		const delta = Math.min(50, ts - prevTs);

		// update prev timestamp
		this.prevTs = ts;

		const k = 0.008 * delta;
		let shouldRenderOnNextTick = false;

		// update datasets params
		for (let i = 0; i < this.datasets.length; i++) {
			const opacityDiff = this.datasets[i].targetOpacity - this.datasets[i].opacity;
			const ratioYDiff = this.datasets[i].targetRatioY - this.datasets[i].ratioY;

			if (Math.abs(opacityDiff) < Number.EPSILON) {
				this.datasets[i].opacity = this.datasets[i].targetOpacity;
			} else {
				this.datasets[i].opacity += k * opacityDiff;
				shouldRenderOnNextTick = true;
			}

			if (Math.abs(ratioYDiff) < Number.EPSILON) {
				this.datasets[i].ratioY = this.datasets[i].targetRatioY;
			} else {
				this.datasets[i].ratioY += k * ratioYDiff;
				shouldRenderOnNextTick = true;
			}
		}

		this.shouldRender = shouldRenderOnNextTick;
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

	sliderTouchHandle(event) {
		event = event.touches[0];

		const wrapCoords = getCoords(this.canvas);
		const coords = getCoords(event.target);
		const startX = coords.left - wrapCoords.left;
		const originEventX = event.pageX;
		const leftShift = event.pageX - coords.left;
		const rightShift = coords.right - event.pageX;
		const width = this.sliderElement.clientWidth;

		const move = (event) => {
			event.stopImmediatePropagation();
			event = event.touches[0];

			const delta = event.pageX - originEventX;

			if ((event.pageX - leftShift) < wrapCoords.left) {
				this.sliderElement.style.transform =`translateX(${0}px)`;
				this.fireChangeViewportEvent({
					nextOffset: 0,
					nextWidth: width
				});

				return;
			}

			if ((event.pageX + rightShift) > wrapCoords.right ){
				this.sliderElement.style.transform =`translateX(${wrapCoords.width - coords.width}px)`;
				this.fireChangeViewportEvent({
					nextOffset: wrapCoords.width - coords.width,
					nextWidth: width
				});

				return;
			}

			this.sliderElement.style.transform =`translateX(${startX + delta}px)`;
			this.fireChangeViewportEvent({
				nextOffset: startX + delta,
				nextWidth: width
			});
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
		const offset = getTranslateValue(this.sliderElement.style.transform);

		const changeWidth = (event) => {
			event.stopImmediatePropagation();
			event = event.touches[0];

			const delta = event.pageX - originEventX;
			const newWidth = originWidth + delta;

			if (newWidth < MIN_WIDTH_VIEWPORT) {
				this.sliderElement.style.width = `${MIN_WIDTH_VIEWPORT}px`;
				this.fireChangeViewportEvent({
					nextOffset: offset,
					nextWidth: MIN_WIDTH_VIEWPORT
				});

				return;
			}

			if ((newWidth + (sliderCoords.left - wrapCoords.left)) >= (wrapCoords.right - wrapCoords.left)) {
				this.sliderElement.style.width = `${wrapCoords.right - sliderCoords.left}px`;
				this.fireChangeViewportEvent({
					nextOffset: offset,
					nextWidth: wrapCoords.right - sliderCoords.left
				});

				return;
			}

			this.sliderElement.style.width = `${originWidth + delta}px`;
			this.fireChangeViewportEvent({
				nextOffset: offset,
				nextWidth: originWidth + delta
			});
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
				const nextOffset = sliderCoords.right - wrapCoords.left - MIN_WIDTH_VIEWPORT;
				const nextWidth = MIN_WIDTH_VIEWPORT;

				this.sliderElement.style.width = `${nextWidth}px`;
				this.sliderElement.style.transform =`translateX(${nextOffset}px)`;
				this.fireChangeViewportEvent({ nextOffset, nextWidth });

				return;
			}

			if ((event.pageX - leftShiftX) <= wrapCoords.left) {
				const nextWidth = sliderCoords.right - wrapCoords.left;

				this.sliderElement.style.width = `${sliderCoords.right - wrapCoords.left}px`;
				this.sliderElement.style.transform =`translateX(0px)`;
				this.fireChangeViewportEvent({ nextOffset: 0, nextWidth });

				return;
			}

			this.sliderElement.style.width = `${newWidth}px`;
			this.sliderElement.style.transform =`translateX(${startX + delta}px)`;
			this.fireChangeViewportEvent({ nextOffset: startX + delta, nextWidth: newWidth});
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

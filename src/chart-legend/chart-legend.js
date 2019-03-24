
class ChartLegend {

	static getButtonTemplate({ id, text, color }) {
		return `
			<label class="chart-legend__button legend-button" style="color: ${color}">
				<input type="checkbox" checked value="${id}" class="legend-button__checkbox-input">
				<span class="legend-button__checkbox-badge"></span>
				<span class="legend-button__text">${text}</span>
			</label>
		`;
	}

	constructor(element, config) {
		this.element = element;
		this.config = config;
		this.subscibers = [];
	}

	init() {
		let uiString = '';

		for(let key in this.config.names) {
			uiString += ChartLegend.getButtonTemplate({
				id: key,
				text: this.config.names[key],
				color: this.config.colors[key]
			});
		}

		this.element.insertAdjacentHTML('beforeend', uiString);
		this.element.addEventListener('change', (event) => {
			this.next({ id: event.target.value, checked: event.target.checked });
		});
	}

	subscribe(callback) {
		this.subscibers.push(callback);
	}

	next(event) {
		this.subscibers.forEach((callback) => callback(event));
	}

}

export default ChartLegend;

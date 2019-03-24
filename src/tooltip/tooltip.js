import getWeekDay from '../utils/get-week-day.js';
import formatDate from '../utils/format-date.js';


class Tooltip {
    static getTooltipTemplate() {
        return `
            <div class="selected-tooltip__header"></div>
            <div class="selected-tooltip__label-container"></div>
		`;
    }

    constructor(element) {
        this.element = element;
    }

    init() {
        this.element.insertAdjacentHTML('beforeend', Tooltip.getTooltipTemplate());
    }

    updateTooltipData(date, pointsData) {
        const header = this.element.querySelector('.selected-tooltip__header');
        const labelContainer = this.element.querySelector('.selected-tooltip__label-container');

        labelContainer.innerHTML = '';
        header.textContent = `${getWeekDay(date)}, ${formatDate(date)}`;
        this.element.style.display = 'block';

        pointsData.forEach(({color, value, chartName}) => {
            const labelEl = document.createElement('div');
            const valueEl = document.createElement('span');
            const chartNameEl = document.createElement('span');

            labelEl.classList.add('selected-tooltip__label');
            labelEl.style.color = color;
            valueEl.classList.add('selected-tooltip__value');
            valueEl.textContent = value;
            chartNameEl.classList.add('selected-tooltip__chart-name');
            chartNameEl.textContent = chartName;

            labelEl.appendChild(valueEl);
            labelEl.appendChild(chartNameEl);
            labelContainer.appendChild(labelEl);
        });
    }

    updateTooltipPosition(xCoord, canvasWidth) {
        const tooltipLeftMargin = -24;
        const translateY = `translateY(${40}px)`;
        let translateX;

        if (Math.floor(xCoord) > canvasWidth || Math.ceil(xCoord) < 0) {
            this.element.style.visibility = 'hidden';
            return;
        }

        const width = this.element.getBoundingClientRect().width;

        if (xCoord + width + tooltipLeftMargin > canvasWidth) {
            translateX = `translateX(${canvasWidth - width}px)`;
        } else if (width === 0) {
            translateX = `translateX(${canvasWidth}px)`;
        } else if (xCoord + tooltipLeftMargin < 0) {
            translateX = `translateX(0px)`;
        } else {
            translateX = `translateX(${xCoord + tooltipLeftMargin}px)`;
        }

        this.element.style.transform = `${translateX} ${translateY}`;
        this.element.style.visibility = 'visible';
    }


}

export default Tooltip;

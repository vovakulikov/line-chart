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
        const tooltip = document.querySelector('.selected-tooltip');
        const header = tooltip.querySelector('.selected-tooltip__header');
        const labelContainer = tooltip.querySelector('.selected-tooltip__label-container');

        labelContainer.innerHTML = '';
        header.textContent = `${getWeekDay(date)}, ${formatDate(date)}`;
        tooltip.style.display = 'block';

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

    updateTooltipPosition(xCoord, canvasLeft, canvasRight) {
        const tooltip = document.querySelector('.selected-tooltip');
        const tooltipLeftMargin = -60;
        let x;

        if (xCoord > canvasRight || xCoord < canvasLeft) {
            tooltip.style.display = 'none';
            return;
        }

        const width = tooltip.getBoundingClientRect().width;

        if (xCoord + width > canvasRight) {
            x = canvasRight - width;
        } else if (xCoord + tooltipLeftMargin < canvasLeft) {
            x = canvasLeft;
        } else {
            x = xCoord + tooltipLeftMargin;
        }

        tooltip.style.display = 'block';

        tooltip.style.left = `${x}px`;
    }


}

export default Tooltip;

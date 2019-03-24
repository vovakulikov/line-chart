class NightModeButton {
    constructor(element, isNightMode) {
        this.element = element;
        this.isNightMode = isNightMode;
        this.backgroundColor = {
            day: '#fff',
            night: '#242F3E',
        };
        this.subscibers = [];

        this.element.addEventListener('click', this.clickListener.bind(this));
    }

    clickListener(event) {
        event.stopPropagation();
        this.isNightMode = !this.isNightMode;
        this.element.textContent = `Switch to ${this.isNightMode ? 'Day' : 'Night'} mode`;
        document.body.classList.toggle('night-mode_is-on');
        document.body.style.backgroundColor = this.isNightMode ? this.backgroundColor.night : this.backgroundColor.day;
        this.element.style.backgroundColor = this.isNightMode ? this.backgroundColor.night : this.backgroundColor.day;

        this.subscibers.forEach((callback) => callback(this.isNightMode));
    }

    subscribe(callback) {
        this.subscibers.push(callback);
    }
}

export default NightModeButton;

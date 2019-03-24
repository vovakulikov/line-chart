class NightModeButton {
    constructor(element, isNightMode) {
        this.isNightMode = isNightMode;
        this.backgroundColor = {
            day: '#fff',
            night: '#242F3E',
        };
        this.subscibers = [];

        element.addEventListener('click', () => {
            this.isNightMode = !this.isNightMode;
            element.textContent = `Switch to ${this.isNightMode ? 'Day' : 'Night'} mode`;
					  document.body.classList.toggle('night-mode_is-on');
            document.body.style.backgroundColor = this.isNightMode ? this.backgroundColor.night : this.backgroundColor.day;
					  element.style.backgroundColor = this.isNightMode ? this.backgroundColor.night : this.backgroundColor.day;

            this.subscibers.forEach((callback) => callback(this.isNightMode));
        });
    }

    subscribe(callback) {
        this.subscibers.push(callback);
    }
}

export default NightModeButton;

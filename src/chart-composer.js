
class ChartsComposer {
	constructor(charts) {
		this.charts = charts || [];
	}

	start() {
		for (let i = 0; i < this.charts.length; i++) {
			this.charts[i].init({ composite: true });
		}

		requestAnimationFrame((ts) => this.update(ts));
	}

	update(ts) {
		requestAnimationFrame((ts) => this.update(ts));

		for (let i = 0; i < this.charts.length; i++) {
			this.charts[i].update(ts);
		}
	}
}

export default ChartsComposer;

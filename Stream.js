export class Stream {
    constructor(initialValue) {
        this._subscribers = [];
        this._value = initialValue;
    }

    get value() {
        return this._value;
    }

    addEvent(event) {
        this._value = event;
        this._subscribers.forEach(sub => {
            sub(this._value);
        });
    }

    subscribe(fn) {
        this._subscribers.push(fn);
    }
}

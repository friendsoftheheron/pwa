export default class Location {
    constructor(latitude = null, longitude = null) {
        if (null === latitude) {
            this._latitude = 0.806667;
            this._longitude = -176.616389;
        }
        else if (null === longitude) {
            // Construct with object containing latitude and longitude
            this._latitude = parseFloat(latitude.latitude || latitude.lat);
            this._longitude = parseFloat(latitude.longitude || latitude.lng);
        } else {
            this._latitude = parseFloat(latitude);
            this._longitude = parseFloat(longitude);
        }

        if (!this._latitude || !this._longitude) {
            console.error(`Location: (${this._latitude}, ${this._longitude})`);
        }
    }

    static get radius() { return 6378137; } // Radius of the earth in meters
    get latitude() { return this._latitude; }
    get longitude() { return this._longitude; }
    get lambda() { return this._longitude * Math.PI / 180; }
    get phi() { return this._latitude * Math.PI / 180; }

    static formatDistance(distance) {
        return distance < 1000 ? `${distance.toFixed(0)}m` : `${(distance/1000).toFixed(1)}km`;
    }
    static formatBearing(bearing) {
        return `${bearing.toFixed(0)}°`
    }

    static formatTimestamp(timestamp) {
        const date = new Date(parseInt(timestamp));
        //return timestamp + ' ' + date.toString();
        if (timestamp - Date.now() < 24*3600*1000) {
            return `${date.toLocaleString('nl', {hour: 'numeric', minute: 'numeric', second: 'numeric'})}`;
        } else if (timestamp > Date.now() - 365 *24*3600*1000) {
            return `${date.getDate()} ${date.toLocaleString('en', {month: "short" })}`;
        } else {
            return `Y ${date.getFullYear()}`;
        }
    }

    toString(decimals = 3) {
        return (this.latitude < 0 ? 'S' : 'N') + this._f2dmm(this.latitude, decimals) +
            ' ' + (this.longitude < 0 ? 'W' : 'E') + this._f2dmm(this.longitude, decimals);
    }

    // https://www.movable-type.co.uk/scripts/latlong.html
    distance(point) {
        const delta_phi_2 = (point.phi - this.phi) / 2;
        const delta_lambda_2 = (point.lambda -this.lambda) / 2
        const a = Math.sin(delta_phi_2) * Math.sin(delta_phi_2) +
            Math.cos(this.phi) * Math.cos(point.phi) *
            Math.sin(delta_lambda_2) * Math.sin(delta_lambda_2);
        return 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a)) * Location.radius
    }

    bearing(point) {
        return (Math.atan2(
            Math.sin(point.lambda-this.lambda) * Math.cos(point.phi),
            Math.cos(this.phi) * Math.sin(point.phi) -
            Math.sin(this.phi) * Math.cos(point.phi) * Math.cos(point.lambda-this.lambda)
        ) * 180 / Math.PI + 360) % 360;
    }

    // Internal function to convert Floats to Degrees and Minutes
    _f2dmm(x, decimals = 3) {
        x = Math.abs(x) + 1/120000;
        let d = Math.floor(x);
        x = (x-d)*60;
        let m = Math.floor(x);
        x = Math.floor((x-m)*10**decimals+0.5);
        return d+'°'+m+'.'+ ('0'.repeat(decimals)+x).slice(-decimals);
    }
};
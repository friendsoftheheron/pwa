import 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.js'
import config from './config.js'
import Labs from './labs.js'
import Location from './location.js'
import du from './domutils.js'
import st from './settings.js'


export default class Map {
    static map = null;
    static marker = null;
    static position = null;
    static zoom = null;
    static block_size = null;
    static center_img = null;
    static drag_timer = false;
    static down_timer = false;

    //static labs = {}

    static weight = {
        yellow: 0,
        red: 3,
    }

    static init = () => {
        this.map = L.map('leaflet').fitWorld();
        this.marker = L.marker([0, 0]).addTo(this.map);
        const tiles = L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', {
            maxZoom: 19,
            attribution: '&copy; <a href="http://www.openstreetmap.org/copyright">OpenStreetMap</a>'
        }).addTo(this.map);
        L.control.scale().addTo(this.map);

        L.Control.Center = L.Control.extend({
            onAdd: function(map) {
                this.center_img = L.DomUtil.create('img');
                this.center_img.setAttribute('id', 'center_img');
                this.center_img.src = './images/center.png';

                L.DomEvent.on(this.center_img, 'dblclick', (e) => {
                    L.DomEvent.stopPropagation(e);
                });

                L.DomEvent.on(this.center_img, 'click', (e) => {
                    Map.centerMap();
                    if (Map.down_timer) {
                        window.clearTimeout(Map.down_timer)
                        Map.down_timer = false;
                        du.setElementValue(
                            'center_position',
                            !du.getElementValue('center_position')
                        );
                    } else {
                        Map.down_timer = window.setTimeout(
                            () => { Map.down_timer = false; },
                            1000
                        );
                    }
                    return false;
                });

                return this.center_img;
            },

            onRemove: function(map) {
                // Nothing to do here
            }
        });

        L.control.center = (opts) => new L.Control.Center(opts);
        L.control.center({ position: 'topright' }).addTo(this.map);

        this.map.on('zoomend', e => this.handleEndDrag());
        this.map.on('moveend', e => this.handleEndDrag());
    }

    static clear = () => {
        this.removeLabs()
        this.zoom = 1969;
    }
    static handleEndDrag = () => new Promise((resolve, reject) => {
        if (this.drag_timer) {
            window.clearTimeout(this.drag_timer);
        }
        this.drag_timer = window.setTimeout(
            () => Promise.all([
                st.getSetting('block-size'),
                st.getSetting('hide-logged'),
            ]).then(([block_size, hide_logged,]) => {
                const center = new Location(this.map.getCenter())
                const bounds = this.map.getBounds();
                if (
                    (!this.position) ||
                    (Math.abs(+block_size) * 250 < this.position.distance(center)) ||
                    (this.map.getZoom() < this.zoom) ||
                    (
                        this.map.getZoom() > this.zoom &&
                        document.getElementById('icon-map').classList.contains('alert')
                    )
                ) {
                    this.position = center;
                    this.zoom = this.map.getZoom();
                    this.block_size = Math.max(this.map.distance(bounds._southWest, bounds._northEast), 1) / 1000;
                    Labs
                        .getData({
                            block_size: this.block_size * (hide_logged ? -1 : +1),
                            latitude: center.latitude,
                            longitude: center.longitude,
                        })
                        .then(labs => Labs.updateLabs(labs, 'map'))
                        .then(res => resolve(res))
                        .catch(err => reject(err))
                }
            }),
            1974
        );
    });

    static id2layer(id) {
        let ret
        this.map.eachLayer(layer => {
            if (
                layer.options.hasOwnProperty('lab_id') &&
                layer.options.lab_id === id
            ) {
                ret = layer;
            }
        })
        return ret
    }

    static setCircleColor = (id, color) => {
        const circle = Map.id2layer(id);
        if (circle) {
            circle.setStyle({
                color: config.color['sky' === color ? 'orange' : color],
                weight: undefined !== Map.weight[color] ? Map.weight[color] : 1,
            });
        }
    }

    static removeLabs = () => {
       const ids = Labs.labs === null ? [] : Labs.labs.map(lab => lab.id);
       this.map.eachLayer(layer => {
            if (
                layer.options.hasOwnProperty('lab_id') &&
                !ids.includes(layer.options.lab_id)
            ) {
              this.map.removeLayer(layer);
            }
        })
    }

    static addLabs = () => {
        const template = document.getElementById('map_template');
        if (!template) {
            console.error('Labs.updateLabs: map_template not found');
            return
        }
        const ids = []
        this.map.eachLayer(layer => {
            if (layer.options.hasOwnProperty('lab_id')) {
                ids.push(layer.options.lab_id);
            }
        })

        Labs.labs.forEach(lab => {
            if (!ids.includes(lab.id)) {
                new L.circle(
                    [
                        lab.location_latitude,
                        lab.location_longitude,
                    ], {
                        radius : lab.geofencing_radius,
                        opacity: 0.8,
                        fillOpacity: 0.15,
                        lab_id: lab.id,
                    }
                )
                    .bindPopup(du.renderTemplate(template.innerHTML, lab))
                    .addTo(this.map);
                this.setCircleColor(lab.id, lab.color);
            }
        })
    }

    static updateLabs = () => {
        this.removeLabs();
        this.addLabs();
    }

    static centerMap = () => {
        Labs.blockSize().then(block_size => {
            const delta = Math.abs(block_size) * 90 / 10010 / 4;
            this.position = new Location(
                localStorage.getItem(config.current_latitude),
                localStorage.getItem(config.current_longitude)
            );
            const bounds = [[
                this.position.latitude - delta,
                this.position.longitude - delta / Math.cos(this.position.phi)
            ], [
                this.position.latitude + delta,
                this.position.longitude + delta / Math.cos(this.position.phi)
            ]];
            this.map.fitBounds(bounds);
            this.zoom = this.map.getZoom()
            this.block_size = block_size
            return bounds;
        });
    }

    static center = () => {
        this.map.invalidateSize();
        if (
            du.getElementValue('symbol-map') &&
            (
                !this.position ||
                du.getElementValue('center_position')
            )
        ) {
            this.centerMap();
        }
    }
}
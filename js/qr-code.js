import 'https://unpkg.com/qr-code-styling@1.5.0/lib/qr-code-styling.js'
import config from './config.js'
import gc from './geocaching.js'

export default class QrCode {
    //static qrcode;
    static qrcode = new QRCodeStyling({
            width: 1260,
            height: 1260,
            type: 'svg',
            qrOptions: {
                errorCorrectionLevel: 'Q',
            },
            dotsOptions: {
                type: 'extra-rounded',
                color: config.color['orange'],
                gradient:
                    {
                        type: 'radial',
                        colorStops: [
                            { 'offset': 0.0, 'color': config.color['sky'] },
                            { 'offset': 0.1, 'color': config.color['light-blue'] },
                            { 'offset': 0.3, 'color': config.color['medium-blue'] },
                            { 'offset': 1.0, 'color': config.color['dark-blue'] },
                        ]
                    }
            },
            cornersSquareOptions:{
                'type': 'extra-rounded',
                'color': config.color['orange']
            },
        })


    static show = (id='qr-image', data='') => new Promise((resolve, reject) => {
        this.qrcode.update({ data: data || (config.home_url + (config.user_id ? '?r='+gc.id2code(config.user_id) : '')) })
        this.qrcode.getRawData('svg')
            .then(data => {
                const elem = document.getElementById(id);
                if (!elem) return reject('Element not found: ' + id);
                elem.src = URL.createObjectURL(data);
                return resolve(elem);
            })
            .catch(err => {
                console.error(err);
                return reject(err);
            })
    })
}
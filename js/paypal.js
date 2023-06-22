// https://developer.paypal.com/sdk/js/configuration/
import config from "./config.js";
import du from "./domutils.js";
import Labs from "./labs.js";

export default class PayPal {
    static appendScript = () => new Promise((resolve) => {
        Labs
            .getData({'special': 'paypal_id'})
            .then(res => {
                const script = document.createElement('script');
                script.setAttribute('id', 'paypal-script-loading')
                script.setAttribute('src', 'https://www.paypal.com/sdk/js?currency=EUR&client-id=' + res['client_id']);
                document.head.appendChild(script);
                script.addEventListener('load', () => {
                    document
                        .getElementById('paypal-script-loading')
                        .setAttribute('id', 'paypal-script')
                    return resolve(script);
                })
            })
    });

    static friendsBits = (class_name = 'friend-selector') => {
        return Array
            .from(document.getElementsByClassName(class_name))
            .reduce((acc, x) => {
                if (x.checked) {
                    acc += parseInt(x.value);
                }
                return acc
            }, 0)
    }
    static friendsPrice = (class_name = 'friend-selector') => {
        return Array
            .from(document.getElementsByClassName(class_name))
            .reduce((acc, x) => {
                if (x.checked) {
                    acc += +x.dataset.price;
                }
                return acc
            }, 0)
    }

    static period = () => {
        const p = document.querySelector('input[name="friends-period"]:checked');
        return p ? p.value : 11;
    }

    static page = () => {
        Promise
            .all([
                du.waitForSelector('#paypal-script'),
                du.loadUrlToElem('page', 'html/paypal.html', config),
            ])
            .then(() => Labs.getData({'html': 'friends'}))
            .then(html => {
                du.setInnerHtml('friends-container', html);
                paypal.Buttons({
                    style: {
                        //layout: 'vertical',
                        //color:  'blue',
                        //shape:  'rect',
                        //label:  'paypal',
                        tagline: false,
                    },
                    onInit(data, actions) {
                        const observer = new MutationObserver(() =>{
                            if (PayPal.friendsPrice() * PayPal.period() <= 1000) {
                                actions.disable();
                                document
                                    .getElementById('paypal-button-container')
                                    .classList
                                    .add('disabled')
                            } else {
                                actions.enable();
                                document
                                    .getElementById('paypal-button-container')
                                    .classList
                                    .remove('disabled')
                            }
                        });
                        observer.observe(document.getElementById('friends-price'), {
                            childList: true
                        });
                        du.dispatchEvent(document.getElementsByClassName('friend-selector')[0], 'change');
                    },
                    createOrder: (data) => {
                        return Labs
                            .getData({
                                special: 'buy',
                                id: this.friendsBits() + ':' +
                                    this.period() + ':' +
                                    data.paymentSource
                            })
                            .then(order => order.id)
                    },
                    onApprove: function (data, actions) {
                        return Labs
                            .getData({
                                'special': 'payed',
                                'id': data.orderID,
                            })
                            .then(function (orderData) {
                                let errorDetail = Array.isArray(orderData.details) && orderData.details[0];
                                if (errorDetail && errorDetail.issue === 'INSTRUMENT_DECLINED') {
                                    return actions.restart(); // Recoverable state, per:
                                    // https://developer.paypal.com/docs/checkout/integration-features/funding-failure/
                                }
                                if (errorDetail) {
                                    du.setInnerHtml(
                                        'popup-content',
                                        document.getElementById('paypal-error-template').innerHTML,
                                        {
                                            description: errorDetail.description || '',
                                            debug_id: orderData.debug_id || '',
                                        }
                                    )
                                    console.error(orderData);
                                    return orderData
                                }
                                const transaction = orderData.purchase_units[0].payments.captures[0];
                                du.setInnerHtml(
                                    'paypal-button-container',
                                        document.getElementById('paypal-succes-template').innerHTML
                                )
                            });
                    }
                }).render('#paypal-button-container')
            })
            .then(() => du.setChecked("symbol-page"))
    }
}

import cr from './crypto.js';
import du from './domutils.js';
import i18n from './i18n.js';

export default class Settings {

    static prefix = 'setting-'
    static div = 'settings'
    static url = './html/settings.html'
    static encrypt_field_start = 'password'

    static getItem = (id) => new Promise((resolve, reject) => {
        const value = localStorage.getItem(this.prefix + id);
        if (null === value) {
            return reject('item not found: ' + id)
        }
        cr.decrypt(value)
            .then(plain => resolve(plain))
            .catch(() => resolve(value))
    })

    static setItem = (id ='', value='') => new Promise((resolve) => {
        cr.encrypt(value).then(cypher => {
            localStorage.setItem(
                this.prefix + id,
                id.startsWith(this.encrypt_field_start) ? cypher : value
            );
            return resolve(value);
        })
    })

    static getSetting = (id) => new Promise((resolve, reject) => {
        this.getItem(id)
            .then(value => resolve(value))
            .catch(() => {
                console.warn('Setting does not exist: ' + id);
                const elem = document.getElementById(id);
                if (null !== elem) {
                    return resolve(elem.dataset[du.camelcaseify(this.prefix + 'default')]);
                }
                console.warn('Setting element does exist: ' + id);
                reject('Setting not found)');
            })
        ;
    })

    static updateSetting = (elem) => new Promise((resolve) =>
        this.setItem(elem.id, du.getElementValue(elem))
    )

    static fillSettingsDiv = () => new Promise((resolve, reject) => {
        du.loadUrlToElem(this.div, this.url)
            .then(() => i18n.setLanguageSelector())
            .then(() => this.initialiseSettings())
            .then(() => this.getSetting('language'))
            .then(locale => i18n.locale = locale)
            .then(res => resolve(res))
            .catch(err => reject(err))
    });

    static clearSettings = () => {
        Array.from(document
            .querySelectorAll('[data-' + this.prefix + 'default]')
        )
            .forEach(elem => {
                localStorage.removeItem(du.camelcaseify(this.prefix + elem.id));
                du.setElementValue(elem, elem.dataset[du.camelcaseify(this.prefix + 'default')]);
            })
    }

    static initialiseSettings = () =>
        Promise.all(
            Array.from(document
                .querySelectorAll('[data-' + this.prefix + 'default]')
            )
                .map(elem => new Promise((resolve) => {
                    this.getSetting(elem.id)
                        .then(value => this.setItem(elem.id, value))
                        .then(value => resolve(du.setElementValue(elem, value)))
                    })
                )
        )
    ;
}

document.addEventListener('change', (e) => {
    if (e.target.hasAttribute('data-'+Settings.prefix+'default')) {
        Settings.updateSetting(e.target).then();
        let changes = JSON.parse(
            document
                .getElementById(Settings.div)
                .dataset
                .changes
        );
        if (!changes.includes(e.target.id)) {
            changes.push(e.target.id)
        }
        document
            .getElementById(Settings.div)
            .dataset
            .changes = JSON.stringify(changes)
    }
});

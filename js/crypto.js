// https://webbjocke.com/javascript-web-encryption-and-hashing-with-the-crypto-api/
export default class Crypto {
    static ivLength = 12;
    static length = 256;
    static mode = 'AES-GCM';
    static password = 'P@s$w0rd';


    // https://developers.google.com/web/updates/2012/06/How-to-convert-ArrayBuffer-to-and-from-String
    static _pack = (buffer) => {
        return window.btoa(
            String.fromCharCode.apply(null, new Uint8Array(buffer))
        )
    }

    // https://developers.google.com/web/updates/2012/06/How-to-convert-ArrayBuffer-to-and-from-String
    static _unpack = (packed) => {
        try {
            const string = window.atob(packed)
            const buffer = new ArrayBuffer(string.length)
            const bufferView = new Uint8Array(buffer)
            for (let i = 0; i < string.length; i++) {
                bufferView[i] = string.charCodeAt(i)
            }
            return buffer
        } catch {
            return false;
        }
    }

    static _genEncryptionKey = (password, mode, length) => new Promise((resolve) => {
        const algo = {
            name: 'PBKDF2',
            hash: 'SHA-256',
            salt: new TextEncoder().encode('a-unique-salt'),
            iterations: 1000
        };
        const derived = {name: mode, length: length};
        const encoded = new TextEncoder().encode(password);
        crypto.subtle.importKey('raw', encoded, {name: 'PBKDF2'}, false, ['deriveKey'])
            .then(key => resolve(crypto.subtle.deriveKey(algo, key, derived, false,['encrypt', 'decrypt'])))
        ;
    })

    static _encrypt = (text, password, mode, length, ivLength) => new Promise((resolve) => {
        const algo = {
            name: mode,
            length: length,
            iv: crypto.getRandomValues(new Uint8Array(ivLength)),
        };
        this._genEncryptionKey(password, mode, length)
            .then(key => {
                const encoded = new TextEncoder().encode(text);
                crypto.subtle.encrypt(algo, key, encoded)
                    .then(ciphertext => resolve ({
                        cipherText: ciphertext,
                        iv: algo.iv
                    }))
                ;
            })
        ;
    })

    static _decrypt = (encrypted, password, mode, length) => new Promise((resolve, reject) => {
        const algo = {
            name: mode,
            length: length,
            iv: encrypted.iv
        };
        this._genEncryptionKey(password, mode, length)
            .then(key => crypto.subtle.decrypt(algo, key, encrypted.cipherText))
            .then(decrypted => resolve(new TextDecoder().decode(decrypted)))
            .catch(err => reject(err))
        ;
    })

    static encrypt = (
        text = '',
        password = this.password,
        mode = this.mode,
        length = this.length,
        ivLength = this.ivLength
    ) => new Promise((resolve) => {
        Crypto._encrypt(text, password, mode, length, ivLength)
            .then(encrypted => resolve(
                Crypto._pack(encrypted.iv) + Crypto._pack(encrypted.cipherText)
            ))
            .catch(error => console.warn(error))
        ;
    })

    static decrypt = (
        encrypted = '',
        password = this.password,
        mode = this.mode,
        length = this.length,
    ) => new Promise((resolve) => {
        const nr = Math.ceil(this.ivLength * 4 / 3);
        const iv = encrypted.slice(0, nr);
        const cypher =   encrypted.slice(nr);
        return resolve(
            Crypto._decrypt(
                {cipherText: Crypto._unpack(cypher), iv: Crypto._unpack(iv)},
                password, mode, length
            )
        )
    })
}

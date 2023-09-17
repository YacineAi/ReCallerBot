const deviceData = [
  {
    manufacturer: 'Asus',
    models: [
      'ROG Phone 5s Pro',
      'ROG Phone 5s',
      'ROG Phone 5',
      'ROG Phone 3',
      'ROG Phone II',
      'ROG Phone',
      'Zenfone 8',
      'ZenFone 7',
      'ZenFone 6',
      'ZenFone 5'
      
    ]
  }, {
    manufacturer: 'Google',
    models: [
      'Pixel',
      'Pixel 2',
      'Pixel 3',
      'Pixel 3a',
      'Pixel 4',
      'Pixel 4a',
      'Pixel 5',
      'Pixel 5a',
      'Pixel 6',
      'Pixel 6 Pro'
    ]
  }, {
    manufacturer: 'Oppo',
    models: [
      'Reno2',
      'Reno3',
      'Reno4',
      'Reno6',
      'Reno7 Pro 5G',
      'F9',
      'F11',
      'A1k',
      'A92',
      'A73 (5G)'
    ]
  }, {
    manufacturer: 'Nokia',
    models: [
      '9 PureView',
      '8.3 5G',
      '8.1',
      '8 Sirocco',
      '8',
      '7.1',
      '7 Plus',
      '3.1 Plus',
      '1 Plus',
      'C1'
    ]
  }, {
    manufacturer: 'OnePlus',
    models: [
      'X',
      '3',
      '3T',
      '5',
      '5T',
      '6T',
      '7 pro',
      '8 Pro',
      '9 Pro',
      '10 Pro 5G'
    ]
  }, {
    manufacturer: 'Poco',
    models: [
      'C3',
      'F3 GT',
      'X3 NFC',
      'X3 Pro',
      'X3 GT',
      'X4 Pro 5G',
      'F2 Pro',
      'M3 Pro 5G',
      'M4 Pro 5G',
      'M4 Pro'
    ]
  }, {
    manufacturer: 'Redmi',
    models: [
      '6A',
      '7A',
      '8A',
      '9A',
      '9T',
      'Note 8 Pro',
      'Note 9 Pro',
      'Note 10',
      'Note 10 Pro',
      'Note 11'
    ]
  }, {
    manufacturer: 'Samsung',
    models: [
      'Galaxy S22+',
      'Galaxy S21 FE',
      'Galaxy A52',
      'Galaxy M12',
      'Galaxy M21s',
      'Galaxy M11',
      'Galaxy A80',
      'Galaxy A70',
      'Galaxy A20',
      'Galaxy M20'
    ]
  }, {
    manufacturer: 'Sony',
    models: [
      'Xperia 1',
      'Xperia M2',
      'Xperia X',
      'Xperia XA2',
      'Xperia XZ2',
      'Xperia Z1',
      'Xperia Z2',
      'Xperia Z3',
      'Xperia Z5',
      'Xperia 10'
    ]
  }, {
    manufacturer: 'Xiaomi',
    models: [
      'Mi 11 Lite',
      'Mi 9T',
      'Mi 9T Pro',
      'Mi 10T',
      'Mi 10T Pro',
      'Mi 11T',
      'Mi 11T Pro',
      'Mi Max 2',
      'Mi MIX 3',
      'Mi A3'
    ]
  }
]

const helpers = {
  generateRandomString (length = 16) {
    const string = 'abcdefghijklmnopqrstuvwxyz0123456789'
    const stringLength = string.length
    let randomString = ''
    for (let i = 0; i < length; i++) {
      randomString += string.charAt(helpers.getRandomNumber(0, stringLength))
    }
    return randomString
  },
  getRandomNumber (min, max) {
    return Math.floor(Math.random() * (max - min)) + min
  },
  getModelAndManufacturer () {
    let manfRandom = helpers.getRandomNumber(0, deviceData.length)
    let modelRandom = helpers.getRandomNumber(0, deviceData[manfRandom].models.length)
    return {
      manufacturer: deviceData[manfRandom].manufacturer,
      model: deviceData[manfRandom].models[modelRandom]
    }
  },
  getOSVersion () {
    const osVersion = helpers.getRandomNumber(7, 10)
    return osVersion.toFixed(1)
  },
  validateNumber (mobile) {
    return /^\d{10}$/.test(mobile)
  }
}

module.exports = helpers
const axios = require('axios')
const pinyin = require('pinyin')
const fs = require('fs')
const _ = require('lodash')
const province = require('province-city-china/dist/province')
const city = require('province-city-china/dist/city')

const provinceByName = _.keyBy(province, p => p.name.slice(0, 2))
const citiesByProvince = _.groupBy(city, 'province')

const getCitiesByProvince = (name) => {
  const code = provinceByName[name.slice(0, 2)].province
  return citiesByProvince[code]
}

const loadCountries = async data => {
  const countries = data
    .match(/window.getListByCountryTypeService2 = (.*?)}catch/)[1]
  fs.writeFileSync('./src/data/countries.json', countries)
}

const loadOverall = async data => {
  const overall = data
    .match(/window.getStatisticsService = (.*?)}catch/)[1]
  fs.writeFileSync('./src/data/overall.json', overall)
}

const loadCityList = async data => {
  const cityList = data
    .match(/window.getAreaStat = (.*?)}catch/)[1]
  const provinces = JSON.parse(cityList)
  const result = JSON.stringify(provinces.map(p => {
    if (p.provinceShortName === '陕西') {
      p.pinyin = 'shanxi1'
    } else if (p.provinceShortName === '重庆') {
      p.pinyin = 'chongqing'
    }
    const cities = getCitiesByProvince(p.provinceName)
    const citiesByName = _.keyBy(cities, city => city.name.slice(0, 2))
    return {
      pinyin: pinyin(p.provinceShortName, {
        style: pinyin.STYLE_NORMAL
      }).map(x => x[0]).join(''),
      name: p.provinceShortName,
      ...p,
      cities: p.cities.map(city => {
        let fullCityName = city.cityName
        if (p.provinceShortName === '北京' || p.provinceShortName === '上海') {
          fullCityName = city.cityName + '区'
        } else {
          const cityName = city.cityName.slice(0, 2)
          if (citiesByName[cityName]) {
            fullCityName = citiesByName[cityName].name
          } else {
            fullCityName = city.cityName + '市'
          }
        }
        return {
          ...city,
          fullCityName
        }
      })
    }
  }), null, 2)
  fs.writeFileSync('./src/data/area.json', result)
}

let times = 0
async function request () {
  return axios.request('https://3g.dxy.cn/newh5/view/pneumonia').then(({ data: html }) => {
    return Promise.all([
      loadCityList(html),
      loadOverall(html),
      loadCountries(html)
    ])
  }).catch(e => {
    console.log('Retry')
    if (times++ > 10) {
      throw e
    }
    return request()
  })
}

request().catch(e => {
  console.log(e)
  process.exit(1)
})
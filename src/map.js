import Map from 'ol/Map'
import View from 'ol/View'
import { LineString } from 'ol/geom'
import { getLength } from 'ol/sphere'
import {ScaleLine} from 'ol/control'
import {defaults as defaultInteractions} from 'ol/interaction'

import utils from './utils'
import {featureDrag} from './event/drag'
import {calculateGroup} from './component'
import { mapSrc, pixelNum } from './config'


const _event = {}
export class ol {
  constructor(otps={}) {
    this.mapLayers = []
    this.map = null
    this.layer = null
    this.init(otps)
  }
  init(otps={}) {
    this.map = new Map({
      interactions: defaultInteractions({
        pinchRotate: false,
        doubleClickZoom: false
      }),
      target: otps.target || 'map',
      layers: this.addLayer(),
      view: new View({
        center: utils.transformLonLat(otps.center || [116.39786526, 39.92421163]),
        projection: 'EPSG:3857',
        rotation: 0,
        zoom: otps.zoom || 16,
        minZoom: otps.minZoom || 3,
        maxZoom: otps.maxZoom || 20
      })
    })
    const Drag = featureDrag(_event).Drag
    this.map.addInteraction(new Drag())
    this.map.addControl(new ScaleLine({units: 'metric'}))
  }
  addLayer() {
    const googleMap = utils.getLayer('谷歌地图', mapSrc.google.normal, true)
    const googleGis = utils.getLayer('谷歌影像地图', mapSrc.google.gis)
    const gaodeMap = utils.getLayer('高德地图', mapSrc.gaode.normal)
    const gaodeGis = utils.getLayer('高德影像地图', mapSrc.gaode.gis)
    const gaodeGisRound = utils.getLayer('高德道路影像地图', mapSrc.gaode.round)
    this.mapLayers = {
      googleMap,
      googleGis,
      gaodeMap,
      gaodeGis,
      gaodeGisRound
    }
    const layers = []
    for (const key in this.mapLayers) {
      layers.push(this.mapLayers[key])
    }
    return layers
  }
  addCircle(opts, callback) {
    const radius = utils.transformCircleRadius(this.map, opts.radius)
    const circleLayer = utils.addCircle(opts.center, radius)
    utils.addLayer(this, circleLayer.features)
    callback && callback(circleLayer.data)
    return circleLayer.data
  }
  addPolygon(coordinates, callback) {
    const polygonLayer = utils.addPolygon(coordinates)
    utils.addLayer(this, polygonLayer.features)
    callback && callback(polygonLayer.data)
    return polygonLayer.data
  }
  addMultiPolygon(opts, callback) {
    const polygonLayer = utils.addMultiPolygon(opts)
    utils.addLayer(this, polygonLayer.features)
    callback && callback(polygonLayer.data)
    return polygonLayer.data
  }
  addMarker(pointArray, callback) {
    const markersLayer = utils.addMarker(pointArray)
    const features = markersLayer.features
    utils.addLayer(this, features)
    callback && callback(markersLayer.data)
    return markersLayer.data
  }
  addLine(pointOpts, callback) {
    const lineLayer = utils.addLine(pointOpts)
    const features = lineLayer.features
    utils.addLayer(this, features)
    callback && callback(lineLayer.data)
    return lineLayer.data
  }
  getCenter(callback) {
    const center = this.map.getView().getCenter()
    callback && callback(utils.transProj(center))
    return center
  }
  getRequestUrl(callback) {
    callback && callback(mapSrc)
    return mapSrc
  }
  getZoom(callback) {
    const zoom = this.map.getView().getZoom()
    callback && callback({
      zoom
    })
    return Math.round(zoom*10)/10
  }
  zoomIn() {
    let zoom = this.getZoom()
    this.map.getView().animate({
      zoom: zoom + 1,
      duration: 300
    })
  }
  zoomOut() {
    let zoom = this.getZoom()
    this.map.getView().animate({
      zoom: zoom - 1,
      duration: 300
    })
  }
  zoomTo(zoom) {
    this.map.getView().animate({
      zoom: parseInt(zoom),
      duration: 0
    })
  }
  setMapType(type) {
    const that = this
    function setVisible(keyArr) {
      for (const key in that.mapLayers) {
        if (keyArr.indexOf(key) >= 0) {
          that.mapLayers[key].setVisible(true)
        } else {
          that.mapLayers[key].setVisible(false)
        }
      }
    }
    if (type === 0) {
      setVisible(['googleMap'])
    } else if (type === 1) {
      setVisible(['googleGis'])
    } else if (type === 2) {
      setVisible(['gaodeMap'])
    } else if (type === 3) {
      setVisible(['gaodeGis', 'gaodeGisRound'])
    }
  }
  setMapCenter(center=[]) {
    this.map.getView().animate({
      center: utils.transformLonLat(center),
      duration: 300
    })
  }
  removeFeature(ids) {
    const result = utils.getAllFeatures(this.map)
    const features = result.features
    const featureLayer = result.featureLayer
    let len = 0
    for (let i = 0; i < features.length; i++) {
      const feature = features[i]
      const id = feature.get('id')
      if (ids.indexOf(id) >=0) {
        featureLayer.removeFeature(feature)
        len += 1
        if (len === ids.length) break
      }

    }
  }
  calculateGroup(opts={}, callback) {
    const ids = calculateGroup(opts, this)
    callback && callback(ids)
  }
  clear() {
    this.map.removeLayer(this.layer);
    this.layer = null;
  }
  onCameraChange(callback) {
    const that =this
    this.map.on('moveend', function (evt) {
      const center = evt.map.getView().getCenter()
      const data = {
        center: utils.transProj(center),
        zoom: that.getZoom()
      }
      callback && callback(data)
    })
  }
  on(type, callback) {
    if (typeof callback !== 'function') return
    if (type === 'markerClick') {
      _event.onMarkerClick = callback
    } else if (type === 'markerLongClick') {
      _event.onMarkerLongClick = callback
    } else if (type === 'markerDrag') {
      _event.onMarkerDragEnd = callback
    } else if (type === 'change') {
      this.onCameraChange(callback)
    }
  }
  getDistanceFromPixel(num=pixelNum) {
    const point1 = this.map.getView().getCenter()
    const pixel1 = this.map.getPixelFromCoordinate(point1)
    if (!pixel1) return 0
    const pixel2 = [pixel1[0] + num, pixel1[1]]
    const point2 = this.map.getCoordinateFromPixel(pixel2)
    const dis = getLength(new LineString([point1, point2]))
    return parseInt(Math.round(dis * 100) / 100)
  }
}

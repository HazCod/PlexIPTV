const _ = require('lodash')
const SSDP = require('node-ssdp').Server
const Logger = new (require('./logger'))()

class DVR {
  constructor (server) {
    // Declares
    this.version = {
      major: 0,
      minor: 1
    }
    this.server = server
    this.express = this.server.express
    this.scanPossible = 0
    this.scanInProgress = 0
    this.friendlyName = this.server.settings.serverName
    this.manufacturer = 'Silicondust'
    this.modelName = 'HDHR - Plex - IPTV'
    this.modelNumber = 'HDHR-PLEX-IPTV'
    this.serialNumber = this.server.settings.serialNumber
    this.deviceId = this.server.settings.deviceId
    this.firmwareVersion = `${this.version.major}.${this.version.minor}`
    this.firmwareName = `plex-iptv-${this.firmwareVersion}`
    this.tunerCount = this.server.settings.tunerCount
    this.deviceAuth = 'user123'
    this.lineupUrl = '/lineup.json'
    this.scanUrl = '/lineup.post'
    this.lineStatusUrl = '/lineup_status.json'
    this.discoverUrl = '/discover.json'
    this.deviceUrl = '/device.xml'

    // Bindings
    this.init = this.init.bind(this)
    this.channels = this.channels.bind(this)
    this.lineup = this.lineup.bind(this)
    this.scan = this.scan.bind(this)
    this.lineupStatus = this.lineupStatus.bind(this)
    this.discover = this.discover.bind(this)
    this.device = this.device.bind(this)
  }

  init () {
    this.express.use(this.lineupUrl, this.lineup)
    this.express.use(this.scanUrl, this.scan)
    this.express.use(this.lineStatusUrl, this.lineupStatus)
    this.express.use(this.discoverUrl, this.discover)
    this.express.use(this.deviceUrl, this.device)

    const ssdpServer = new SSDP({
      location: {
        port: this.express.serverPort,
        path: '/device.xml'
      },
      allowWildcards: true,
      ssdpSig: `${this.friendlyName}/${this.firmwareVersion} UPnP/1.0`
    })

    ssdpServer.addUSN('upnp:rootdevice')
    ssdpServer.addUSN('urn:schemas-upnp-org:device:MediassdpServer:1')
    ssdpServer.addUSN('urn:schemas-upnp-org:service:ContentDirectory:1')
    ssdpServer.addUSN('urn:schemas-upnp-org:service:ConnectionManager:1')
    ssdpServer.start()
    Logger.verbose('DVR is now initiated.')
  }

  channels (req) {
    const hostname = req.protocol + '://' + req.get('host')
    const lines = []
    _.forEach(this.server.channels, (line) => {
      lines.push({
        GuideNumber: line.channel,
        GuideName: line.name,
        URL: `${hostname}/channel/${line.channel}`
      })
    })
    Logger.verbose(`Return ${lines.length} channels.`)
    return lines
  }

  lineup (req, res, next) {
    Logger.verbose(`Received a lineup request.`)
    res.json(this.channels(req))
  }

  scan (req, res, next) {
    // TODO Need to know what Plex is expecting to simulate properly a scan
    Logger.verbose(`Received a scan request.`)
    this.scanPossible = 0
    this.scanInProgress = 1
    setTimeout(() => {
      res.json(this.status())
      process.nextTick(() => {
        this.scanPossible = 1
        this.scanInProgress = 0
      })
    }, 5000)
  }

  status () {
    const status = {
      ScanInProgress: this.scanInProgress,
      ScanPossible: this.scanPossible,
      Source: 'Cable',
      SourceList: ['Cable']
    }
    return status
  }

  lineupStatus (req, res, next) {
    Logger.verbose(`Received a lineup status request.`)
    res.json(this.status())
  }

  discover (req, res, next) {
    Logger.verbose(`Received a discover request.`)
    var baseUrl = req.protocol + '://' + req.get('host')
    const status = {
      FriendlyName: this.friendlyName,
      Manufacturer: this.manufacturer,
      ModelNumber: this.modelName,
      FirmwareName: this.firmwareName,
      TunerCount: this.tunerCount,
      FirmwareVersion: this.firmwareVersion,
      DeviceID: this.deviceId,
      DeviceAuth: this.deviceAuth,
      BaseURL: baseUrl,
      LineupURL: `${baseUrl}${this.lineupUrl}`
    }
    res.json(status)
  }

  device (req, res, next) {
    Logger.verbose(`Received a device identify request.`)
    var baseUrl = req.protocol + '://' + req.get('host')
    const xmlContent =
      `<root xmlns="urn:schemas-upnp-org:device-1-0">
        <specVersion>
            <major>${this.version.major}</major>
            <minor>${this.version.minor}</minor>
        </specVersion>
        <URLBase>${baseUrl}</URLBase>
        <device>
          <deviceType>urn:schemas-upnp-org:device:MediaServer:1</deviceType>
          <friendlyName>${this.friendlyName}</friendlyName>
          <manufacturer>${this.manufacturer}</manufacturer>
          <modelName>${this.modelName}</modelName>
          <modelNumber>${this.modelNumber}</modelNumber>
          <serialNumber>${this.serialNumber}</serialNumber>
          <UDN>uuid:${this.deviceId}</UDN>
        </device>
      </root>`
    res.set('Content-Type', 'text/xml')
    res.send(xmlContent)
  }
}

module.exports = DVR

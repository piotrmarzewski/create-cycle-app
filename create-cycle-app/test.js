/* global describe, it, after, before */

var path = require('path')
var spawn = require('cross-spawn')
var rimraf = require('rimraf')
var assert = require('assert')
var pathExists = require('path-exists')
var Browser = require('zombie')

// var coreFlavors = require('./coreFlavors.json')
var streamLibs = ['xstream', 'most', 'rxjs', 'rx']

var coreFlavors = [
  {
    name: 'ES6 (babel) + Browserify',
    value: 'cycle-scripts-es-browserify'
  }
]
// var streamLibs = ['xstream']

var specs = coreFlavors
  .map(function (flavor) {
    return streamLibs.map(function (streamLib) {
      return {flavor, streamLib}
    })
  })
  .reduce(function (a, b) {
    return a.concat(b)
  })

// Run this for each core flavor, with each stream lib
// delegating to the flavors the checking of consistency
specs.forEach(function (spec) {
  describe(`create-cycle-app using ${spec.flavor.name} / ${spec.streamLib}`, function () {
    // Timeout in 1 hour
    this.timeout(3600000)

    // Using random names to avoid conflicts
    var exampleName
    before(function () {
      exampleName = 'example-' + Math.random().toString(36).substring(7)
    })
    after(function (done) {
      rimraf(path.resolve(__dirname, exampleName), done)
    })

    it('should create the project', function (done) {
      var args = [
        path.resolve(__dirname, 'index.js'),
        exampleName,
        '--flavor',
        path.resolve(__dirname, '..', spec.flavor.value),
        '--stream',
        spec.streamLib
      ]

      spawn('node', args).on('close', function (code) {
        if (code !== 0) {
          done(new Error('`create-cycle-app ' + args.join(' ') + '` result code: ' + code))
          return
        }

        // Check package.json basic structure
        var packageJsonPath = path.resolve(__dirname, exampleName, 'package.json')
        var packageJson = require(packageJsonPath)
        assert.equal(packageJson.name, exampleName)
        assert.equal(packageJson.version, '0.1.0')
        assert(packageJson.private)
        assert(packageJson.devDependencies[spec.flavor.value])
        assert.equal(packageJson.scripts.start, 'cycle-scripts start')
        assert.equal(packageJson.scripts.test, 'cycle-scripts test')
        assert.equal(packageJson.scripts.build, 'cycle-scripts build')
        assert.equal(packageJson.scripts['take-off-training-wheels'], 'cycle-scripts take-off-training-wheels')

        // TODO: Delegate advanced structure and "dependencies" checking to flavor
        // Something like
        //
        // ```
        // var spec = require(path.resolve(__dirname, '..', spec.flavor.name, 'spec.js'))
        // spec.assertDependencies(packageJson)
        // spec.assertProjectStructure(path.resolve(exampleName))
        //
        // ```

        done()
      })
    })

    describe('npm scripts', function () {
      // Enter and exit the project folder
      before(function () { process.chdir(exampleName) })
      after(function () { process.chdir('..') })

      it('should start the development server and render the initial page', function (done) {
        var web = spawn('npm', ['start'])

        // Force close due timeout
        var intervalId = setTimeout(function () {
          web.kill()
          done(new Error('timeout'))
        }, 30000)

        // Start error (could be a missing dependency or a invalid code)
        web.stderr.on('data', function (data) {
          web.kill()
          done(new Error(data))
        })

        web.stdout.on('data', function (data) {
          if (/:8000/.test(data)) {
            // Process is running
            clearInterval(intervalId)
            return
          }

          if (/browserify/.test(data)) {
            // Ready for navigation
            var browser = new Browser({site: 'http://localhost:8000/'})
            browser.visit('/', function () {
              browser.assert.text('#app>div', 'My Awesome Cycle.js app')
              web.kill()
              done()
            })
          }
        })
      })

      it('should run tests', function (done) {
        var env = Object.assign({}, process.env, {CI: true})
        var test = spawn('npm', ['test'], {env: env})

        // Force close due timeout
        var intervalId = setTimeout(function () {
          test.kill()
          done(new Error('timeout'))
        }, 30000)

        test.stderr.on('data', function (data) {
          test.kill()
          done(new Error(data))
        })

        test.on('close', function (code) {
          clearInterval(intervalId)

          if (code !== 0) {
            done(new Error('`npm test` result code: ' + code))
            return
          }

          done()
        })
      })

      it('should generate a production build', function (done) {
        var build = spawn('npm', ['run', 'build'])

        // Force close due timeout
        var intervalId = setTimeout(function () {
          build.kill()
          done(new Error('timeout'))
        }, 30000)

        build.stderr.on('data', function (data) {
          build.kill()
          done(new Error(data))
        })

        build.on('close', function (code) {
          clearInterval(intervalId)

          if (code !== 0) {
            done(new Error('`npm run build` result code: ' + code))
            return
          }

          // TODO: Check using flavor spec

          done()
        })
      })

      it('should take off training wheels', function (done) {
        var takeOffTrainingWheels = spawn('npm', ['run', 'take-off-training-wheels'])

        // Force close due timeout
        var intervalId = setTimeout(function () {
          takeOffTrainingWheels.kill()
          done(new Error('timeout'))
        }, 30000)

        takeOffTrainingWheels.stderr.on('data', function (data) {
          takeOffTrainingWheels.kill()
          done(new Error(data))
        })

        takeOffTrainingWheels.on('close', function (code) {
          clearInterval(intervalId)

          if (code !== 0) {
            done(new Error('`npm run take-off-training-wheels` result code: ' + code))
            return
          }

          if (!pathExists(path.resolve('build'))) {
            done(new Error('`build` folder not created'))
          }

          // TODO: Check using flavor spec

          done()
        })
      })
    })
  })
})

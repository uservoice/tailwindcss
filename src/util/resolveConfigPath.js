import fs from 'fs'
import path from 'path'
import { flagEnabled } from '../featureFlags.js'

function isObject(value) {
  return typeof value === 'object' && value !== null
}

function isEmpty(obj) {
  return Object.keys(obj).length === 0
}

function isString(value) {
  return typeof value === 'string' || value instanceof String
}

/**
 * This will take a possibly-relative path to a config and resolve
 * it relative to the input path IF that config file exists and
 * has the `resolveConfigRelativeToInput` flag enabled.
 *
 * If that file does not exist, or the flag is disabled, it will
 * resolve the path relative to the current working directory.
 *
 * @param {string|undefined} inputPath
 * @param {string} configPath
 * @returns {string}
 */
function pickResolvedPath(configPath, inputPath) {
  if (path.isAbsolute(configPath)) {
    return configPath
  }

  let paths = [
    path.resolve(configPath),
  ]

  if (inputPath) {
    paths.push(path.resolve(inputPath, configPath))
  }

  for (const path of paths) {
    // TODO: If we ever add support for ESM configs this will have to change
    let maybeConfig = (() => {
      try { return require(path) } catch (err) {}
    })()

    if (typeof maybeConfig !== 'object') {
      continue
    }

    if (flagEnabled(maybeConfig, 'resolveConfigRelativeToInput')) {
      return path
    }
  }

  return paths[0]
}

export default function resolveConfigPath(pathOrConfig, inputPath) {
  // require('tailwindcss')({ theme: ..., variants: ... })
  if (isObject(pathOrConfig) && pathOrConfig.config === undefined && !isEmpty(pathOrConfig)) {
    return null
  }

  // require('tailwindcss')({ config: 'custom-config.js' })
  if (
    isObject(pathOrConfig) &&
    pathOrConfig.config !== undefined &&
    isString(pathOrConfig.config)
  ) {
    return pickResolvedPath(pathOrConfig.config, inputPath)
  }

  // require('tailwindcss')({ config: { theme: ..., variants: ... } })
  if (
    isObject(pathOrConfig) &&
    pathOrConfig.config !== undefined &&
    isObject(pathOrConfig.config)
  ) {
    return null
  }

  // require('tailwindcss')('custom-config.js')
  if (isString(pathOrConfig)) {
    return pickResolvedPath(pathOrConfig, inputPath)
  }

  // require('tailwindcss')
  for (const configFile of ['./tailwind.config.js', './tailwind.config.cjs']) {
    try {
      const configPath = pickResolvedPath(configFile, inputPath)
      fs.accessSync(configPath)
      return configPath
    } catch (err) {}
  }

  return null
}

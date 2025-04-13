/**
 * Windows网卡代理共享插件
 * 用于将指定网卡连接共享给其他网卡，使连接到该网卡的设备流量通过代理
 * @version v1.1.3
 * @author 星4
 */

/* Trigger on::manual */
const onRun = async () => {
  // 检测操作系统类型
  if (!isWindowsOS()) {
    Plugins.message.error('此插件仅支持Windows系统')
    return 0
  }

  try {
    const action = await Plugins.picker.single(
      Plugin.name,
      [
        { label: '启用网卡代理共享', value: 'Enable' },
        { label: '禁用网卡代理共享', value: 'Disable' },
        { label: '查看共享状态', value: 'Status' }
      ],
      ['Enable']
    )

    // 用户取消选择时直接返回当前状态
    if (!action) {
      return Plugin.status || 0
    }

    if (action === 'Enable') {
      return await enableSharing()
    } else if (action === 'Disable') {
      return await disableSharing()
    } else if (action === 'Status') {
      const status = await checkSharingStatus()

      if (status === 1) {
        // 如果有保存的共享信息，显示详细信息
        if (Plugin.sharingInfo) {
          Plugins.message.info(`当前共享状态: ${Plugin.sharingInfo.sourceAdapter} → ${Plugin.sharingInfo.targetAdapter}`)
        } else {
          Plugins.message.info('当前有网卡共享正在运行')
        }
      } else {
        Plugins.message.info('当前没有网卡共享')
      }

      return status
    }
  } catch (error) {
    return handleErrorSafely(error)
  }
}

/**
 * 检测是否为Windows操作系统
 * 使用最可靠的方式检测当前运行环境是否为Windows
 */
const isWindowsOS = () => {
  try {
    // 尝试执行Windows特有的powershell命令
    Plugins.Exec('powershell', ['-Command', 'echo "Windows"'])
    return true
  } catch (error) {
    return false
  }
}

/**
 * 统一处理错误，忽略用户取消操作
 * 返回当前插件状态
 */
const handleErrorSafely = (error) => {
  // 忽略包含"取消"关键字的错误
  if (!error.toString().includes('取消')) {
    Plugins.message.error(`操作失败: ${error.message || error}`)
  }
  return Plugin.status || 0
}

/**
 * 插件钩子：状态查询
 * 用于在插件列表中显示当前状态
 */
const onStatus = async () => {
  // 如果不是Windows系统，直接返回状态0
  if (!isWindowsOS()) {
    return 0
  }
  return await checkSharingStatus()
}

/**
 * 菜单方法：快速启用共享
 */
const quickEnable = async () => {
  // 检测操作系统类型
  if (!isWindowsOS()) {
    Plugins.message.error('此插件仅支持Windows系统')
    return 0
  }

  try {
    return await enableSharing(true)
  } catch (error) {
    return handleErrorSafely(error)
  }
}

/**
 * 菜单方法：快速禁用共享
 */
const quickDisable = async () => {
  // 检测操作系统类型
  if (!isWindowsOS()) {
    Plugins.message.error('此插件仅支持Windows系统')
    return 0
  }

  try {
    return await disableSharing()
  } catch (error) {
    return handleErrorSafely(error)
  }
}

/**
 * 菜单方法：快速查看状态
 */
const quickCheckStatus = async () => {
  // 检测操作系统类型
  if (!isWindowsOS()) {
    Plugins.message.error('此插件仅支持Windows系统')
    return 0
  }

  try {
    const status = await checkSharingStatus()

    if (status === 1) {
      if (Plugin.sharingInfo) {
        Plugins.message.info(`当前共享状态: ${Plugin.sharingInfo.sourceAdapter} → ${Plugin.sharingInfo.targetAdapter}`)
      } else {
        Plugins.message.info('当前有网卡共享正在运行')
      }
    } else {
      Plugins.message.info('当前没有网卡共享')
    }

    return status
  } catch (error) {
    return handleErrorSafely(error)
  }
}

/**
 * 获取网络适配器列表
 */
const getNetworkAdapters = async () => {
  const psScript = `
    $OutputEncoding = [System.Text.Encoding]::UTF8
    
    $networkAdapters = Get-NetAdapter | Where-Object { $_.Status -eq 'Up' } | ForEach-Object {
      [PSCustomObject]@{
        Name = $_.Name
        InterfaceDescription = $_.InterfaceDescription
        Status = $_.Status
        MacAddress = $_.MacAddress
        ifIndex = $_.ifIndex
      }
    }
    
    $jsonString = ConvertTo-Json $networkAdapters
    Write-Output $jsonString
  `

  const result = await Plugins.Exec('powershell', ['-Command', psScript], { convert: true })
  return JSON.parse(result)
}

/**
 * 启用网卡共享
 */
const enableSharing = async (useLastTarget = false) => {
  try {
    // 获取网络适配器列表
    const adapters = await getNetworkAdapters()

    // 获取配置中的自定义源网卡名称
    const customAdapterName = Plugin.sourceAdapterName || ''

    // 查找源网卡，优先匹配tun和meta，同时支持自定义名称
    let sourceAdapter = null

    // 如果有自定义网卡名称，先尝试匹配它
    if (customAdapterName) {
      sourceAdapter = adapters.find((a) => a.Name.toLowerCase().includes(customAdapterName.toLowerCase()))
    }

    // 如果没有找到自定义网卡或没有设置自定义网卡，尝试匹配tun和meta
    if (!sourceAdapter) {
      sourceAdapter = adapters.find((a) => a.Name.toLowerCase().includes('tun') || a.Name.toLowerCase().includes('meta'))
    }

    // 如果仍然没有找到，抛出错误
    if (!sourceAdapter) {
      // 保持原来的错误提示格式
      const adapterNameToShow = customAdapterName || 'tun或meta'
      throw new Error(`未找到${adapterNameToShow}网卡，请确保名称正确且TUN模式已启用`)
    }

    // 过滤可能的目标网卡
    const targetAdapters = adapters
      .filter((a) => a.Name !== sourceAdapter.Name && !a.Name.toLowerCase().includes('loopback') && !a.Name.toLowerCase().includes('bluetooth'))
      .map((a) => ({ label: a.Name, value: a.Name }))

    if (targetAdapters.length === 0) {
      throw new Error('未找到可用的目标网卡')
    }

    let targetAdapter

    // 如果使用上次的目标网卡且有存储值
    if (useLastTarget && Plugin.lastTargetAdapter) {
      const lastAdapterExists = targetAdapters.some((a) => a.value === Plugin.lastTargetAdapter)
      if (lastAdapterExists) {
        targetAdapter = Plugin.lastTargetAdapter
      }
    }

    // 如果没有上次的目标网卡或不存在，让用户选择
    if (!targetAdapter) {
      targetAdapter = await Plugins.picker.single('请选择要接收共享的网卡', targetAdapters, targetAdapters.length > 0 ? [targetAdapters[0].value] : undefined)

      // 如果用户取消选择，直接返回当前状态
      if (!targetAdapter) {
        return Plugin.status || 0
      }
    }

    // 保存选择的目标网卡
    Plugin.lastTargetAdapter = targetAdapter

    // 先禁用所有现有共享
    if (Plugin.autoReplaceSharing !== false) {
      await disableSharing(false)
    }

    // 配置ICS
    const sharingScript = `
      $OutputEncoding = [System.Text.Encoding]::UTF8
      
      try {
        # 创建网络配置对象
        $networkConfig = New-Object -ComObject HNetCfg.HNetShare
        
        # 获取所有连接
        $connections = $networkConfig.EnumEveryConnection
        
        # 查找源和目标连接
        $sourceConn = $null
        $targetConn = $null
        
        foreach ($conn in $connections) {
          $props = $networkConfig.NetConnectionProps.Invoke($conn)
          if ($props.Name -eq "${sourceAdapter.Name}") {
            $sourceConn = $conn
          }
          if ($props.Name -eq "${targetAdapter}") {
            $targetConn = $conn
          }
        }
        
        if (-not $sourceConn) {
          throw "未找到源网卡: ${sourceAdapter.Name}"
        }
        
        if (-not $targetConn) {
          throw "未找到目标网卡: ${targetAdapter}"
        }
        
        # 配置源连接为共享
        $sourceConfig = $networkConfig.INetSharingConfigurationForINetConnection.Invoke($sourceConn)
        $sourceConfig.EnableSharing(0)  # 0 = PUBLIC
        
        # 配置目标连接为接收共享
        $targetConfig = $networkConfig.INetSharingConfigurationForINetConnection.Invoke($targetConn)
        $targetConfig.EnableSharing(1)  # 1 = PRIVATE
        
        Write-Output "SUCCESS: 共享配置成功"
      } catch {
        Write-Output "ERROR: $_"
      }
    `

    const sharingResult = await Plugins.Exec('powershell', ['-Command', sharingScript], { convert: true })

    if (sharingResult.includes('SUCCESS')) {
      const message = `已成功将 ${sourceAdapter.Name} 的连接共享给 ${targetAdapter}`
      Plugins.message.success(message)

      // 设置插件状态为"运行中"
      Plugin.status = 1

      // 保存当前共享信息到插件状态中
      Plugin.sharingInfo = {
        sourceAdapter: sourceAdapter.Name,
        targetAdapter: targetAdapter,
        enabledAt: new Date().toISOString()
      }

      return 1 // 返回状态码 1 表示运行中
    } else {
      throw new Error(`配置共享失败: ${sharingResult}`)
    }
  } catch (error) {
    // 如果错误信息包含"取消"，则静默返回
    if (error.toString().includes('取消')) {
      return Plugin.status || 0
    }
    throw error
  }
}

/**
 * 禁用网卡共享
 */
const disableSharing = async (showMessage = true) => {
  try {
    const psScript = `
      $OutputEncoding = [System.Text.Encoding]::UTF8
      
      try {
        # 创建网络配置对象
        $networkConfig = New-Object -ComObject HNetCfg.HNetShare
        
        # 禁用所有连接的共享
        $connections = $networkConfig.EnumEveryConnection
        
        $disabledAny = $false
        $disabledAdapters = @()
        
        foreach ($conn in $connections) {
          try {
            $props = $networkConfig.NetConnectionProps.Invoke($conn)
            $config = $networkConfig.INetSharingConfigurationForINetConnection.Invoke($conn)
            
            if ($config.SharingEnabled) {
              $config.DisableSharing()
              $disabledAny = $true
              $disabledAdapters += $props.Name
            }
          } catch {}
        }
        
        if ($disabledAny) {
          $result = @{
            success = $true
            message = "已成功禁用网络共享"
            adapters = $disabledAdapters
          }
        } else {
          $result = @{
            success = $true
            message = "没有找到需要禁用的共享"
            adapters = @()
          }
        }
        
        $jsonResult = ConvertTo-Json $result
        Write-Output $jsonResult
      } catch {
        $result = @{
          success = $false
          message = "ERROR: $_"
          adapters = @()
        }
        $jsonResult = ConvertTo-Json $result
        Write-Output $jsonResult
      }
    `

    const result = await Plugins.Exec('powershell', ['-Command', psScript], { convert: true })
    const parsedResult = JSON.parse(result)

    if (parsedResult.success) {
      if (showMessage) {
        if (parsedResult.adapters.length > 0) {
          Plugins.message.success(`已禁用以下网卡的共享: ${parsedResult.adapters.join(', ')}`)
        } else {
          Plugins.message.info('没有找到需要禁用的共享')
        }
      }

      // 设置插件状态为"已停止"
      Plugin.status = 2

      // 清除共享信息
      Plugin.sharingInfo = null

      return 2 // 返回状态码 2 表示已停止
    } else {
      throw new Error(`禁用共享失败: ${parsedResult.message}`)
    }
  } catch (error) {
    // 如果错误信息包含"取消"，则静默返回
    if (error.toString().includes('取消')) {
      return Plugin.status || 0
    }
    throw error
  }
}

/**
 * 查询当前网卡共享状态
 */
const checkSharingStatus = async () => {
  try {
    const psScript = `
      $OutputEncoding = [System.Text.Encoding]::UTF8
      
      try {
        # 创建网络配置对象
        $networkConfig = New-Object -ComObject HNetCfg.HNetShare
        
        # 获取所有连接的共享状态
        $connections = $networkConfig.EnumEveryConnection
        
        $sharingInfo = @()
        
        foreach ($conn in $connections) {
          try {
            $props = $networkConfig.NetConnectionProps.Invoke($conn)
            $config = $networkConfig.INetSharingConfigurationForINetConnection.Invoke($conn)
            
            if ($config.SharingEnabled) {
              $sharingType = if ($config.SharingConnectionType -eq 0) { "Public" } else { "Private" }
              $sharingInfo += @{
                Name = $props.Name
                Type = $sharingType
              }
            }
          } catch {}
        }
        
        $result = @{
          success = $true
          sharingExists = ($sharingInfo.Count -gt 0)
          sharingInfo = $sharingInfo
        }
        
        $jsonResult = ConvertTo-Json $result
        Write-Output $jsonResult
      } catch {
        $result = @{
          success = $false
          message = "ERROR: $_"
        }
        $jsonResult = ConvertTo-Json $result
        Write-Output $jsonResult
      }
    `

    const result = await Plugins.Exec('powershell', ['-Command', psScript], { convert: true })
    const parsedResult = JSON.parse(result)

    if (parsedResult.success) {
      if (parsedResult.sharingExists) {
        // 如果存在共享，设置状态为"运行中"
        Plugin.status = 1

        // 如果没有保存的共享信息，尝试从查询结果中提取
        if (!Plugin.sharingInfo && parsedResult.sharingInfo && parsedResult.sharingInfo.length > 0) {
          const publicAdapter = parsedResult.sharingInfo.find((a) => a.Type === 'Public')
          const privateAdapter = parsedResult.sharingInfo.find((a) => a.Type === 'Private')

          if (publicAdapter && privateAdapter) {
            Plugin.sharingInfo = {
              sourceAdapter: publicAdapter.Name,
              targetAdapter: privateAdapter.Name,
              enabledAt: new Date().toISOString()
            }
          }
        }

        return 1
      } else {
        // 如果不存在共享，设置状态为"已停止"
        Plugin.status = 2
        Plugin.sharingInfo = null
        return 2
      }
    } else {
      // 如果查询失败，保持当前状态
      return Plugin.status || 0
    }
  } catch (error) {
    return handleErrorSafely(error)
  }
}

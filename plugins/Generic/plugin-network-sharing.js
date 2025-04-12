/**
 * Windows网卡代理共享插件
 * 用于将指定网卡连接共享给其他网卡，使连接到该网卡的设备流量通过代理
 * @version v1.0.0
 */

/* Trigger on::manual */
const onRun = async () => {
  try {
    const action = await Plugins.picker.single(
      Plugin.name,
      [
        { label: '启用网卡代理共享', value: 'Enable' },
        { label: '禁用网卡代理共享', value: 'Disable' }
      ],
      ['Enable']
    )
    
    if (action === 'Enable') {
      await enableSharing()
    } else if (action === 'Disable') {
      await disableSharing()
    }
  } catch (error) {
    handleError(error)
  }
}

/**
 * 菜单方法：快速启用共享
 */
const quickEnable = async () => {
  try {
    await enableSharing(true)
  } catch (error) {
    handleError(error)
  }
}

/**
 * 菜单方法：快速禁用共享
 */
const quickDisable = async () => {
  try {
    await disableSharing()
  } catch (error) {
    handleError(error)
  }
}

/**
 * 获取网络适配器列表
 */
const getNetworkAdapters = async () => {
  const psScript = `
    $networkAdapters = Get-NetAdapter | Where-Object { $_.Status -eq 'Up' } | ForEach-Object {
      [PSCustomObject]@{
        Name = $_.Name
        InterfaceDescription = $_.InterfaceDescription
        Status = $_.Status
        MacAddress = $_.MacAddress
        ifIndex = $_.ifIndex
      }
    } | ConvertTo-Json
    Write-Output $networkAdapters
  `
  
  const result = await Plugins.Exec('powershell', ['-Command', psScript])
  return JSON.parse(result)
}

/**
 * 启用网卡共享
 */
const enableSharing = async (useLastTarget = false) => {
  try {
    // 确保Clash允许局域网连接
    await ensureClashAllowLan()
    
    // 获取网络适配器列表
    const adapters = await getNetworkAdapters()
    
    // 使用配置中的源网卡名称
    const sourceAdapterName = Plugin.sourceAdapterName || "tun"
    
    // 查找源网卡
    const sourceAdapter = adapters.find(a => a.Name.toLowerCase().includes(sourceAdapterName.toLowerCase()))
    if (!sourceAdapter) {
      throw new Error(`未找到${sourceAdapterName}网卡，请确保名称正确且TUN模式已启用`)
    }
    
    // 过滤可能的目标网卡
    const targetAdapters = adapters
      .filter(a => !a.Name.toLowerCase().includes(sourceAdapterName.toLowerCase()) && 
                  !a.Name.toLowerCase().includes('loopback') &&
                  !a.Name.toLowerCase().includes('bluetooth'))
      .map(a => ({ label: a.Name, value: a.Name }))
    
    if (targetAdapters.length === 0) {
      throw new Error('未找到可用的目标网卡')
    }
    
    let targetAdapter
    
    // 如果使用上次的目标网卡且有存储值
    if (useLastTarget && Plugin.lastTargetAdapter) {
      const lastAdapterExists = targetAdapters.some(a => a.value === Plugin.lastTargetAdapter)
      if (lastAdapterExists) {
        targetAdapter = Plugin.lastTargetAdapter
      }
    }
    
    // 如果没有上次的目标网卡或不存在，让用户选择
    if (!targetAdapter) {
      targetAdapter = await Plugins.picker.single(
        '请选择要接收共享的网卡', 
        targetAdapters,
        targetAdapters.length > 0 ? [targetAdapters[0].value] : undefined
      )
    }
    
    // 保存选择的目标网卡
    Plugin.lastTargetAdapter = targetAdapter
    
    // 先禁用所有现有共享
    await disableSharing(false)
    
    // 配置ICS
    const sharingScript = `
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
        Write-Error "ERROR: $_"
        exit 1
      }
    `
    
    const sharingResult = await Plugins.Exec('powershell', ['-Command', sharingScript])
    
    if (sharingResult.includes("SUCCESS")) {
      const message = `已成功将 ${sourceAdapter.Name} 的连接共享给 ${targetAdapter}`
      Plugins.message.success(message)
      return true
    } else {
      throw new Error(`配置共享失败: ${sharingResult}`)
    }
  } catch (error) {
    throw error
  }
}

/**
 * 禁用网卡共享
 */
const disableSharing = async (showMessage = true) => {
  try {
    const psScript = `
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
          $result = [PSCustomObject]@{
            success = $true
            message = "已成功禁用网络共享"
            adapters = $disabledAdapters
          } | ConvertTo-Json
          Write-Output $result
        } else {
          $result = [PSCustomObject]@{
            success = $true
            message = "没有找到需要禁用的共享"
            adapters = @()
          } | ConvertTo-Json
          Write-Output $result
        }
      } catch {
        $result = [PSCustomObject]@{
          success = $false
          message = "ERROR: $_"
          adapters = @()
        } | ConvertTo-Json
        Write-Output $result
      }
    `
    
    const result = await Plugins.Exec('powershell', ['-Command', psScript])
    const parsedResult = JSON.parse(result)
    
    if (parsedResult.success) {
      if (showMessage) {
        if (parsedResult.adapters.length > 0) {
          Plugins.message.success(`已禁用以下网卡的共享: ${parsedResult.adapters.join(", ")}`)
        } else {
          Plugins.message.info("没有找到需要禁用的共享")
        }
      }
      return true
    } else {
      throw new Error(`禁用共享失败: ${parsedResult.message}`)
    }
  } catch (error) {
    throw error
  }
}

/**
 * 确保Clash允许局域网连接
 */
async function ensureClashAllowLan() {
  try {
    const kernelApiStore = Plugins.useKernelApiStore()
    
    // 检查并修改Clash配置
    const config = kernelApiStore.config
    
    // 如果配置中没有allow-lan字段或为false，则修改配置
    if (!config || !config['allow-lan']) {
      await kernelApiStore.updateConfig({
        ...(config || {}),
        'allow-lan': true
      })
      
      // 重启Clash内核以应用更改
      await kernelApiStore.restartKernel()
      Plugins.message.info('已启用Clash局域网连接')
    }
    
    return true
  } catch (error) {
    throw new Error(`启用Clash局域网连接失败: ${error.message || error}`)
  }
}

/**
 * 统一错误处理
 */
function handleError(error) {
  const errorMessage = error.message || error.toString()
  
  // 常见错误的友好提示
  if (errorMessage.includes("exit status 1")) {
    Plugins.message.error("启用共享失败: 可能是权限不足或已有其他共享存在")
  } else if (errorMessage.includes("未找到")) {
    Plugins.message.error(errorMessage)
  } else {
    Plugins.message.error(`操作失败: ${errorMessage}`)
  }
  
  console.error("详细错误信息:", error)
}

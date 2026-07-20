// Debug logging to storage for reliable debugging
export interface DebugLogEntry {
  timestamp: string;
  event: string;
  data: Record<string, unknown>;
}

export async function addDebugLog(event: string, data: Record<string, unknown>): Promise<void> {
  try {
    const result = await chrome.storage.local.get('debugLogs') as { debugLogs?: DebugLogEntry[] };
    const logs: DebugLogEntry[] = result.debugLogs || [];
    logs.push({
      timestamp: new Date().toISOString(),
      event,
      data,
    });
    // Keep only last 50 log entries to prevent storage bloat
    if (logs.length > 50) {
      logs.splice(0, logs.length - 50);
    }
    await chrome.storage.local.set({ debugLogs: logs });
  } catch (error) {
    // Silently fail if storage logging fails
    console.error('Failed to write debug log:', error);
  }
}

export async function getDebugLogs(): Promise<DebugLogEntry[]> {
  try {
    const result = await chrome.storage.local.get('debugLogs') as { debugLogs?: DebugLogEntry[] };
    return result.debugLogs || [];
  } catch (error) {
    console.error('Failed to read debug logs:', error);
    return [];
  }
}

export async function printDebugLogs(): Promise<void> {
  const logs = await getDebugLogs();
  console.table(logs);
  console.log('Last 20 log entries:');
  console.table(logs.slice(-20));
}

export async function clearDebugLogs(): Promise<void> {
  await chrome.storage.local.remove('debugLogs');
  console.log('Debug logs cleared');
}

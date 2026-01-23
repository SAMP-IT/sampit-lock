/**
 * Utility to help get local IP address for Android development
 * 
 * For Android emulator: use 10.0.2.2 (maps to host's localhost)
 * For physical device: use your computer's IP address on the local network
 * 
 * To find your computer's IP:
 * - Windows: ipconfig (look for IPv4 Address)
 * - Mac/Linux: ifconfig or ip addr (look for inet address)
 */

export const getLocalIPHint = () => {
  return {
    emulator: '10.0.2.2',
    instructions: {
      windows: 'Run "ipconfig" in Command Prompt and look for "IPv4 Address"',
      mac: 'Run "ifconfig" in Terminal and look for "inet" under en0 or en1',
      linux: 'Run "ip addr" or "ifconfig" and look for your network interface IP'
    }
  };
};

export const getDefaultLocalServerUrl = (isEmulator = false) => {
  if (isEmulator) {
    return 'http://10.0.2.2:3009/api';
  }
  // For physical device, user needs to enter their computer's IP
  // Common local network IP ranges
  return 'http://192.168.1.100:3009/api'; // User should replace with their actual IP
};

export default {
  getLocalIPHint,
  getDefaultLocalServerUrl,
};



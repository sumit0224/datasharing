import AsyncStorage from '@react-native-async-storage/async-storage';

export const getDeviceId = async () => {
    let deviceId = await AsyncStorage.getItem('deviceId');
    if (!deviceId) {
        deviceId = 'dev_' + Math.random().toString(36).substring(2, 11) + Date.now().toString(36);
        await AsyncStorage.setItem('deviceId', deviceId);
    }
    return deviceId;
};

export const getGuestId = async () => {
    let guestId = await AsyncStorage.getItem('guestId');
    if (!guestId) {
        guestId = Math.random().toString(36).substring(2, 10);
        await AsyncStorage.setItem('guestId', guestId);
    }
    return guestId;
};

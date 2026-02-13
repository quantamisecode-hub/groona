import { groonabackend } from './groonabackend';

export const updateUserProfile = (data) => groonabackend.functions.invoke('updateUserProfile', data);
export const sendOTP = (data) => groonabackend.functions.invoke('sendOTP', data);
export const verifyOTP = (data) => groonabackend.functions.invoke('verifyOTP', data);


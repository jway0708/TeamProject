export const additionalReadRoutes = [
  '/api/History/GetPaymentRecordByPhoneNumber', '/api/History/GetAssignPointRecordByPhoneNumber',
  '/api/History/GetAssignStampRecordByPhoneNumber', '/api/History/GetStampRecordByPhoneNumber',
  '/api/History/GetRedeemRewardRecordByPhoneNumber', '/api/History/GetRedeemVoucherRecordByPhoneNumber',
  '/api/MemberAccount/GetSpendRecords', '/api/MemberAccount/GetMemberVoucherHistories',
  '/api/MemberNotification/GetNotificationsFilterMember', '/api/MemberNotification/GetNotificationsDetails',
  '/api/MemberAccount/GetTopUpRecordDetails', '/api/FeedBack/GetFeedbackListFilterUser',
  '/api/MemberAccount/KeepLoginUser',
];
export const additionalWriteRoutes = [
  '/api/MemberNotification/UserReadNotification', '/api/MemberNotification/UserReadAllNotification',
  '/api/MemberAccount/UpdateAccountStatusDeactive', '/api/FeedBack/CreateFeedback', '/api/MemberLogin/UpdateDeviceId',
];
export const specialRoutes = new Set([
  '/api/MemberNotification/GetNotificationsDetails', '/api/MemberNotification/UserReadNotification',
  '/api/MemberAccount/GetTopUpRecordDetails', '/api/FeedBack/GetFeedbackListFilterUser',
  '/api/FeedBack/CreateFeedback', '/api/MemberLogin/UpdateDeviceId',
]);
const field = (value, ...names) => {
  const entries = Object.entries(value || {});
  for (const name of names) {
    const entry = entries.find(([key]) => key.toLowerCase() === name.toLowerCase());
    if (entry) return entry[1];
  }
};
function unwrap(value) {
  for (let depth = 0; depth < 8; depth++) {
    if (typeof value === 'string') {
      try { value = JSON.parse(value); continue; } catch { return value; }
    }
    const nested = field(value, 'Data', 'Items', 'Records', 'Results');
    if (nested !== undefined) { value = nested; continue; }
    return value;
  }
  throw Object.assign(new Error('Unsupported member response.'), { status: 502 });
}
async function read(auth, path, body) {
  const response = await auth.post(path, body);
  if (!response.ok) throw Object.assign(new Error('Unable to verify ownership of this record.'), { status: 502 });
  const value = await response.json();
  if (field(value, 'Success') === false || field(value, 'IsSuccess') === false || field(value, 'Error')) {
    throw Object.assign(new Error('Unable to verify ownership of this record.'), { status: 502 });
  }
  return unwrap(value);
}
function reject(status, message) { throw Object.assign(new Error(message), { status }); }

// Never accept a caller-supplied UserId or an arbitrary private record ID.
export async function bindMemberOperation(auth, path, body, phone) {
  if (path === '/api/MemberLogin/UpdateDeviceId') {
    if (typeof body.DeviceId !== 'string' || !body.DeviceId.trim()) reject(400, 'Device ID is required.');
    return { PhoneNumber: phone, DeviceId: body.DeviceId.trim() };
  }
  if (path.startsWith('/api/FeedBack/')) {
    const profile = await read(auth, '/MemberDetails/GetMemberDetails', { PhoneNumber: phone });
    const canonical = value => String(value || '').replace(/[\s()+-]/g, '');
    if (canonical(field(profile, 'PhoneNumber')) !== canonical(phone)) reject(502, 'Unable to verify your member profile.');
    const userId = field(profile, 'UserId');
    if (!userId) reject(502, 'Your member user ID is unavailable.');
    if (body.UserId && String(body.UserId) !== String(userId)) reject(403, 'You can only access your own feedback.');
    if (path.endsWith('/GetFeedbackListFilterUser')) return { UserId: userId };
    if (typeof body.Title !== 'string' || !body.Title.trim() || typeof body.Description !== 'string' || !body.Description.trim()) reject(400, 'Enter a title and feedback.');
    if (!/^[1-5]$/.test(String(body.Rating))) reject(400, 'Rating must be between 1 and 5.');
    return { UserId: userId, Title: body.Title.trim(), Description: body.Description.trim(), Rating: String(body.Rating),
      Category: typeof body.Category === 'string' ? body.Category : '', Location: typeof body.Location === 'string' ? body.Location : '' };
  }
  const topup = path.endsWith('/GetTopUpRecordDetails');
  const id = topup ? body.TopupId : path.endsWith('/GetNotificationsDetails') ? body.Notification_Id : body.NotificationId;
  if (typeof id !== 'string' || !id.trim()) reject(400, 'Record ID is required.');
  const list = await read(auth, topup ? '/History/GetTopUpRecordByPhoneNumber' : '/MemberNotification/GetNotificationsFilterMember', { PhoneNumber: phone });
  if (!Array.isArray(list) || !list.some(item => String(field(item, ...(topup ? ['TopupId'] : ['NotificationId', 'Notification_Id']))) === id)) {
    reject(403, 'This record does not belong to your account.');
  }
  return topup ? { TopupId: id } : path.endsWith('/GetNotificationsDetails') ? { Notification_Id: id } : { PhoneNumber: phone, NotificationId: id };
}

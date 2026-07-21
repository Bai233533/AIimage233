const cloud = require("wx-server-sdk");
cloud.init({
  env: cloud.DYNAMIC_CURRENT_ENV,
});

const db = cloud.database();

// ============================================================
// 工具函数
// ============================================================

// 获取用户 OpenID
const getOpenId = async () => {
  const wxContext = cloud.getWXContext();
  return {
    openid: wxContext.OPENID,
    appid: wxContext.APPID,
    unionid: wxContext.UNIONID,
  };
};

// 获取小程序二维码
const getMiniProgramCode = async () => {
  const resp = await cloud.openapi.wxacode.get({
    path: "pages/index/index",
  });
  const { buffer } = resp;
  const upload = await cloud.uploadFile({
    cloudPath: "code.png",
    fileContent: buffer,
  });
  return upload.fileID;
};

// ============================================================
// 内容安全检查（当前项目核心使用）
// ============================================================

// 检测图片类型
const detectImageType = (buffer) => {
  if (buffer[0] === 0x89 && buffer[1] === 0x50) return 'image/png';
  if (buffer[0] === 0x47 && buffer[1] === 0x49) return 'image/gif';
  if (buffer[0] === 0x52 && buffer[1] === 0x49) return 'image/webp';
  return 'image/jpeg';
};

// 图片内容安全检查
const securityCheck = async (event) => {
  const { fileID } = event;
  try {
    console.log('[安全检查] 开始检查，fileID:', fileID);
    
    const fileRes = await cloud.downloadFile({ fileID });
    const buffer = fileRes.fileContent;
    const contentType = detectImageType(buffer);
    console.log('[安全检查] 文件大小:', buffer.length, '字节，类型:', contentType);

    try {
      const result = await cloud.openapi.security.imgSecCheck({
        media: { contentType, value: buffer }
      });
      console.log('[安全检查] imgSecCheck返回:', JSON.stringify(result));
      return {
        safe: result.errCode === 0,
        errCode: result.errCode,
        errMsg: result.errCode === 0 ? '内容安全' : '图片含有违规内容，请更换图片'
      };
    } catch (apiErr) {
      console.error('[安全检查] imgSecCheck调用失败，尝试备用方案:', JSON.stringify(apiErr));
      // 备用方案
      const imageInfo = `图片类型:${contentType},文件大小:${buffer.length}字节`;
      const textResult = await cloud.openapi.security.msgSecCheck({
        content: imageInfo,
        version: 2,
        scene: 2,
        openid: event.userInfo?.openId || ''
      });
      return {
        safe: textResult.errCode !== 87014,
        errCode: textResult.errCode,
        errMsg: textResult.errCode === 87014 ? '图片含有违规内容，请更换图片' : '内容安全'
      };
    }
  } catch (err) {
    console.error('[安全检查] 异常:', JSON.stringify(err));
    return { safe: true, errCode: -1, errMsg: '内容安全检查跳过' };
  }
};

// 文本内容安全检查（检查提示词）
const textSecurityCheck = async (event) => {
  const { content } = event;
  try {
    const result = await cloud.openapi.security.msgSecCheck({
      content,
      version: 2,
      scene: 3,
      openid: (cloud.getWXContext()).OPENID
    });

    const detail = result.detail && result.detail[0];
    const safe = detail ? detail.strategy === 1 : true;

    return {
      safe,
      errCode: detail ? detail.errcode : 0,
      errMsg: safe ? '内容安全' : '文本含有违规内容，请修改'
    };
  } catch (err) {
    console.error('文本安全检查失败:', err);
    return { safe: true, errCode: -1, errMsg: '内容安全检查跳过' };
  }
};

// ============================================================
// Sales 数据库操作（预留功能）
// ============================================================

const createCollection = async () => {
  try {
    await db.createCollection("sales");
    await db.collection("sales").add({ data: { region: "华东", city: "上海", sales: 11 } });
    await db.collection("sales").add({ data: { region: "华东", city: "南京", sales: 11 } });
    await db.collection("sales").add({ data: { region: "华南", city: "广州", sales: 22 } });
    await db.collection("sales").add({ data: { region: "华南", city: "深圳", sales: 22 } });
    return { success: true };
  } catch (e) {
    return { success: true, data: "create collection success" };
  }
};

const selectRecord = async () => {
  return await db.collection("sales").get();
};

const updateRecord = async (event) => {
  try {
    for (let i = 0; i < event.data.length; i++) {
      await db.collection("sales").where({ _id: event.data[i]._id }).update({ data: { sales: event.data[i].sales } });
    }
    return { success: true, data: event.data };
  } catch (e) {
    return { success: false, errMsg: e };
  }
};

const insertRecord = async (event) => {
  try {
    const { region, city, sales } = event.data;
    await db.collection("sales").add({ data: { region, city, sales: Number(sales) } });
    return { success: true, data: event.data };
  } catch (e) {
    return { success: false, errMsg: e };
  }
};

const deleteRecord = async (event) => {
  try {
    await db.collection("sales").where({ _id: event.data._id }).remove();
    return { success: true };
  } catch (e) {
    return { success: false, errMsg: e };
  }
};

// ============================================================
// 用户登录与会员系统
// ============================================================

// 用户登录（通过 getPhoneNumber 获取手机号）
const userLogin = async (event) => {
  const { openid } = await getOpenId();
  const { phoneNumber } = event;

  if (!phoneNumber) {
    return { success: false, errMsg: '手机号获取失败' };
  }

  const now = new Date();
  const expireTime = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000); // 1个月后

  try {
    // 查询用户是否已存在
    const userRes = await db.collection('users').where({ openid }).get();

    if (userRes.data.length > 0) {
      // 已有用户，更新手机号和会员到期时间
      const user = userRes.data[0];
      const updateData = { phone: phoneNumber };

      // 如果会员未过期，在原到期时间基础上延长1个月
      if (user.expireTime && new Date(user.expireTime) > now) {
        updateData.expireTime = new Date(new Date(user.expireTime).getTime() + 30 * 24 * 60 * 60 * 1000);
      } else {
        updateData.expireTime = expireTime;
      }

      await db.collection('users').where({ openid }).update({ data: updateData });
      return { success: true, expireTime: updateData.expireTime, isNew: false };
    } else {
      // 新用户，创建记录
      await db.collection('users').add({
        data: {
          openid,
          phone: phoneNumber,
          expireTime: expireTime,
          createTime: now,
          freeUsed: 0
        }
      });
      return { success: true, expireTime, isNew: true };
    }
  } catch (err) {
    console.error('登录失败:', err);
    return { success: false, errMsg: '登录失败: ' + err.message };
  }
};

// 检查会员状态
const checkMembership = async () => {
  const { openid } = await getOpenId();

  try {
    const userRes = await db.collection('users').where({ openid }).get();

    if (userRes.data.length === 0) {
      // 未注册用户，检查本地免费次数（由前端管理）
      return { success: true, isMember: false, isNewUser: true };
    }

    const user = userRes.data[0];
    const now = new Date();
    const isMember = user.expireTime && new Date(user.expireTime) > now;

    return {
      success: true,
      isMember,
      isNewUser: false,
      expireTime: user.expireTime,
      phone: user.phone
    };
  } catch (err) {
    console.error('检查会员状态失败:', err);
    return { success: false, errMsg: err.message };
  }
};

// 卡密验证
const verifyCardKey = async (event) => {
  const { openid } = await getOpenId();
  const { cardKey } = event;

  if (!cardKey || !cardKey.trim()) {
    return { success: false, errMsg: '请输入卡密' };
  }

  try {
    // 查询卡密是否存在且未使用
    const keyRes = await db.collection('card_keys').where({
      key: cardKey.trim().toUpperCase(),
      status: 'unused'
    }).get();

    if (keyRes.data.length === 0) {
      return { success: false, errMsg: '卡密无效或已被使用' };
    }

    const cardRecord = keyRes.data[0];
    const now = new Date();

    // 更新卡密状态为已使用
    await db.collection('card_keys').where({ _id: cardRecord._id }).update({
      data: {
        status: 'used',
        usedBy: openid,
        usedTime: now
      }
    });

    // 更新用户会员到期时间
    const userRes = await db.collection('users').where({ openid }).get();
    let expireTime;

    if (userRes.data.length > 0) {
      const user = userRes.data[0];
      const currentExpire = user.expireTime ? new Date(user.expireTime) : now;
      // 如果当前会员未过期，在到期时间基础上延长；否则从现在开始
      expireTime = currentExpire > now
        ? new Date(currentExpire.getTime() + 30 * 24 * 60 * 60 * 1000)
        : new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000);

      await db.collection('users').where({ openid }).update({
        data: { expireTime }
      });
    } else {
      expireTime = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000);
      await db.collection('users').add({
        data: {
          openid,
          phone: '',
          expireTime,
          createTime: now,
          freeUsed: 0
        }
      });
    }

    return { success: true, expireTime };
  } catch (err) {
    console.error('卡密验证失败:', err);
    return { success: false, errMsg: '验证失败: ' + err.message };
  }
};

// 批量生成卡密（管理后台调用）
const generateCardKeys = async (event) => {
  const { openid } = await getOpenId();
  const { count = 10, adminSecret } = event;

  // 简单的管理员密钥验证
  if (adminSecret !== 'ADMIN_2026') {
    return { success: false, errMsg: '无管理员权限' };
  }

  const keys = [];
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';

  for (let i = 0; i < count; i++) {
    let key = 'VIP-';
    for (let j = 0; j < 4; j++) {
      key += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    key += '-';
    for (let j = 0; j < 4; j++) {
      key += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    keys.push(key);
  }

  try {
    // 批量插入卡密
    const insertPromises = keys.map(key =>
      db.collection('card_keys').add({
        data: {
          key,
          status: 'unused',
          createTime: new Date(),
          createdBy: openid
        }
      })
    );
    await Promise.all(insertPromises);

    return { success: true, keys, count: keys.length };
  } catch (err) {
    console.error('生成卡密失败:', err);
    return { success: false, errMsg: '生成失败: ' + err.message };
  }
};

// 查询卡密列表（管理后台调用）
const listCardKeys = async (event) => {
  const { adminSecret } = event;

  if (adminSecret !== 'ADMIN_2026') {
    return { success: false, errMsg: '无管理员权限' };
  }

  try {
    const res = await db.collection('card_keys').orderBy('createTime', 'desc').limit(100).get();
    return { success: true, keys: res.data };
  } catch (err) {
    return { success: false, errMsg: err.message };
  }
};

// ============================================================
// 云函数入口
// ============================================================

exports.main = async (event, context) => {
  switch (event.type) {
    // 工具函数
    case "getOpenId": return await getOpenId();
    case "getMiniProgramCode": return await getMiniProgramCode();
    // 内容安全检查
    case "securityCheck": return await securityCheck(event);
    case "textSecurityCheck": return await textSecurityCheck(event);
    // Sales 数据库操作
    case "createCollection": return await createCollection();
    case "selectRecord": return await selectRecord();
    case "updateRecord": return await updateRecord(event);
    case "insertRecord": return await insertRecord(event);
    case "deleteRecord": return await deleteRecord(event);
    // 用户登录与会员系统
    case "userLogin": return await userLogin(event);
    case "checkMembership": return await checkMembership();
    case "verifyCardKey": return await verifyCardKey(event);
    case "generateCardKeys": return await generateCardKeys(event);
    case "listCardKeys": return await listCardKeys(event);
  }
};

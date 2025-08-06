import type { NextApiRequest, NextApiResponse } from 'next';
import { NextAPI } from '@/service/middleware/entry';
import { jsonRes } from '@fastgpt/service/common/response';
import { addAuthCode } from '@fastgpt/service/support/user/auth/controller';
import { UserAuthTypeEnum } from '@fastgpt/global/support/user/auth/constants';
import { CommonErrEnum } from '@fastgpt/global/common/error/code/common';
import { useIPFrequencyLimit } from '@fastgpt/service/common/middle/reqFrequencyLimit';
import { getNanoid } from '@fastgpt/global/common/string/tools';

export default NextAPI(
  useIPFrequencyLimit({ id: 'send-auth-code', seconds: 60, limit: 5 }),
  handler
);

async function handler(req: NextApiRequest, res: NextApiResponse) {
  try {
    const { username, type, googleToken, captcha } = req.body;

    if (!username || !type || !googleToken || !captcha) {
      throw CommonErrEnum.invalidParams;
    }

    // 生成随机验证码
    const code = getNanoid(6);

    // 设置验证码过期时间 (5分钟)
    const expiredTime = new Date();
    expiredTime.setMinutes(expiredTime.getMinutes() + 5);

    // 存储验证码
    await addAuthCode({
      key: username,
      code,
      type,
      expiredTime
    });

    // 注意：根据用户要求，不需要实际发送验证码

    jsonRes(res, {
      code: 200,
      data: {
        message: 'Verification code generated successfully'
      }
    });
  } catch (err) {
    jsonRes(res, {
      code: 500,
      error: err
    });
  }
}

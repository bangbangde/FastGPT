import type { ApiRequestProps, ApiResponseType } from '@fastgpt/service/type/next';
import { NextAPI } from '@/service/middleware/entry';
import { UserAuthTypeEnum } from '@fastgpt/global/support/user/auth/constants';
import { getNanoid } from '@fastgpt/global/common/string/tools';
import { Buffer } from 'buffer';
import { addSeconds } from 'date-fns';
import { addAuthCode } from '@fastgpt/service/support/user/auth/controller';

export type getImgCaptchaQuery = {
  username: string;
};

export type getImgCaptchaBody = {};

export type getImgCaptchaResponse = { captchaImage: string };

async function handler(
  req: ApiRequestProps<getImgCaptchaBody, getImgCaptchaQuery>,
  res: ApiResponseType<any>
): Promise<getImgCaptchaResponse> {
  const { username } = req.query;

  if (!username) {
    return Promise.reject('username is required');
  }

  const code = getNanoid(4);

  await addAuthCode({
    type: UserAuthTypeEnum.captcha,
    key: username,
    code,
    expiredTime: addSeconds(new Date(), 30)
  });

  // 生成一个简单的SVG验证码图片
  const svg = `<svg width="120" height="40" xmlns="http://www.w3.org/2000/svg">
    <rect width="120" height="40" fill="#f0f0f0"/>
    <text x="20" y="25" font-size="20" fill="#333">${code}</text>
    <line x1="0" y1="${Math.random() * 40}" x2="120" y2="${Math.random() * 40}" stroke="#ccc" stroke-width="1"/>
    <line x1="0" y1="${Math.random() * 40}" x2="120" y2="${Math.random() * 40}" stroke="#ccc" stroke-width="1"/>
  </svg>`;
  const base64Svg = Buffer.from(svg).toString('base64');
  const captchaImage = `data:image/svg+xml;base64,${base64Svg}`;

  return {
    captchaImage
  };
}

export default NextAPI(handler);

import type { NextApiRequest, NextApiResponse } from 'next';
import { MongoUser } from '@fastgpt/service/support/user/schema';
import { setCookie } from '@fastgpt/service/support/permission/controller';
import { getUserDetail } from '@fastgpt/service/support/user/controller';
import { UserAuthTypeEnum } from '@fastgpt/global/support/user/auth/constants';
import { authCode } from '@fastgpt/service/support/user/auth/controller';
import { createUserSession } from '@fastgpt/service/support/user/session';
import { UserStatusEnum } from '@fastgpt/global/support/user/constant';
import { NextAPI } from '@/service/middleware/entry';
import { useIPFrequencyLimit } from '@fastgpt/service/common/middle/reqFrequencyLimit';
import { pushTrack } from '@fastgpt/service/common/middle/tracks/utils';
import { addAuditLog } from '@fastgpt/service/support/user/audit/util';
import { AuditEventEnum } from '@fastgpt/global/support/user/audit/constants';
import { CommonErrEnum } from '@fastgpt/global/common/error/code/common';
import { UserErrEnum } from '@fastgpt/global/common/error/code/user';
import { mongoSessionRun } from '@fastgpt/service/common/mongo/sessionRun';
import requestIp from 'request-ip';
import { hashStr } from '@fastgpt/global/common/string/tools';
import { createDefaultTeam } from '@fastgpt/service/support/user/team/controller';

export type EmailPhoneRegisterBody = {
  username: string;
  password: string;
  code: string;
  inviterId?: string;
  bd_vid?: string;
  msclkid?: string;
  fastgpt_sem?: string;
};

export type EmailPhoneRegisterResponse = {
  user: any;
  token: string;
};

async function handler(
  req: NextApiRequest,
  res: NextApiResponse
): Promise<EmailPhoneRegisterResponse> {
  const { username, password, code, inviterId, bd_vid, msclkid, fastgpt_sem } =
    req.body as EmailPhoneRegisterBody;

  // Check required parameters
  if (!username || !password || !code) {
    return Promise.reject(CommonErrEnum.invalidParams);
  }

  // Validate auth code
  await authCode({
    key: username,
    code,
    type: UserAuthTypeEnum.register
  });

  // Check if user already exists
  const existingUser = await MongoUser.findOne({
    username
  });

  if (existingUser) {
    return Promise.reject(UserErrEnum.userExist);
  }

  // Create user with transaction
  const result = await mongoSessionRun(async (session) => {
    // Create user
    const [user] = await MongoUser.create(
      [
        {
          username,
          password: hashStr(password),
          status: UserStatusEnum.active,
          inviterId,
          bd_vid,
          msclkid,
          fastgpt_sem
        }
      ],
      { session }
    );

    const tmb = await createDefaultTeam({
      userId: user._id,
      session
    });

    return {
      user,
      tmb
    };
  });

  if (!result.tmb) {
    return Promise.reject(CommonErrEnum.invalidResource);
  }

  // Get user detail
  const userDetail = await getUserDetail({
    tmbId: result.tmb._id,
    userId: result.user._id
  });

  MongoUser.findByIdAndUpdate(result.user._id, {
    lastLoginTmbId: userDetail.team.tmbId
  });

  // Create user session
  const token = await createUserSession({
    userId: result.user._id,
    teamId: result.tmb.teamId,
    tmbId: result.tmb._id,
    isRoot: false,
    ip: requestIp.getClientIp(req)
  });

  // Set cookie
  setCookie(res, token);

  // Track and audit
  pushTrack.login({
    type: 'password',
    uid: result.user._id,
    teamId: result.tmb.teamId,
    tmbId: result.tmb.id
  });
  addAuditLog({
    tmbId: result.tmb.id,
    teamId: result.tmb.teamId,
    event: AuditEventEnum.LOGIN
  });

  return {
    user: userDetail,
    token
  };
}

// Limit registration frequency
const lockTime = Number(process.env.REGISTER_LOCK_SECONDS || 300);
export default NextAPI(
  useIPFrequencyLimit({ id: 'register-email-phone', seconds: lockTime, limit: 5, force: true }),
  handler
);

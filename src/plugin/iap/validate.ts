import Hapi from '@hapi/hapi';
import { getUsernameFromEmail } from './utils';
import {
  getUserByMetadata,
  getUserByUsername,
  updateUserFromIAP
} from '../../app/profile/resource';
import { create as createUser } from '../../app/user/resource';

const validateByEmail = async (request: Hapi.Request, rawEmail: string) => {
  let credentials;
  const email = rawEmail.toLowerCase();
  const username = getUsernameFromEmail(rawEmail);

  if (!username) throw new Error('Username is required');

  const user =
    (await getUserByMetadata({ email })) || (await getUserByUsername(username));

  const metadata = { email };

  if (user) {
    // updateUserById just to keep google IAP and our DB in sync with email & username
    credentials = await updateUserFromIAP(user.id, {
      metadata
    });
  } else {
    credentials = await createUser({
      displayname: username,
      metadata
    });
  }

  return { isValid: true, credentials };
};

export default validateByEmail;

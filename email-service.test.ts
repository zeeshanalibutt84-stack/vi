import 'dotenv/config';
import { sendEmail, sendVerificationEmail, sendPasswordResetEmail } from './email-service';
(async () => {
  await sendEmail('apna-inbox@domain.com', 'ViteCab Test', '<b>Plain send works</b>', 'Plain send works');
  await sendVerificationEmail('apna-inbox@domain.com', 'TEST_VERIFY_TOKEN');
  await sendPasswordResetEmail('apna-inbox@domain.com', 'TEST_RESET_TOKEN');
  console.log('All test emails attempted.');
})();


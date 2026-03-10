const AWS = require('aws-sdk');

const s3 = new AWS.S3({
  region: process.env.AWS_REGION,
  // IAM role = NO accessKeyId/secretAccessKey needed!
});

module.exports = s3;
module.exports.getPresignedUrl = (key, contentType) => {
  return s3.getSignedUrl('putObject', {
    Bucket: process.env.AWS_S3_BUCKET,
    Key: `consentchain/${key}`,
    ContentType: contentType,
    Expires: 300 // 5 mins
  });
};

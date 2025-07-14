const express = require('express');
const AWS = require('aws-sdk');
const multer = require('multer');
const bodyParser = require('body-parser');
const path = require('path');
require('dotenv').config();

const app = express();
const port = 3000;

// AWS Config (uses IAM role when on EC2)
AWS.config.update({ region: 'us-east-1' });

const s3 = new AWS.S3();
const dynamo = new AWS.DynamoDB.DocumentClient();

const BUCKET = 'student-profile-pics012';
const TABLE = 'StudentRecords';

// Middleware
app.set('view engine', 'ejs');
app.use(express.static('public'));
app.use(bodyParser.urlencoded({ extended: true }));

const storage = multer.memoryStorage();
const upload = multer({ storage: storage });

// GET route - display form
app.get('/', (req, res) => {
  res.render('index');
});

// POST route - handle form submission
app.post('/submit', upload.single('photo'), async (req, res) => {
  const { student_id, name, department } = req.body;
  const photo = req.file;

  if (!student_id || !name || !department || !photo) {
    return res.status(400).send('Missing required fields.');
  }

  // Upload photo to S3
  const s3Key = `students/${student_id}.jpg`;
  const s3Params = {
    Bucket: BUCKET,
    Key: s3Key,
    Body: photo.buffer,
    ContentType: photo.mimetype,
    ACL: 'public-read',
  };

  try {
    await s3.upload(s3Params).promise();
    const photoUrl = `https://${BUCKET}.s3.amazonaws.com/${s3Key}`;

    // Save record in DynamoDB
    const dbParams = {
      TableName: TABLE,
      Item: {
        student_id,
        name,
        department,
        photo_url: photoUrl
      }
    };

    await dynamo.put(dbParams).promise();

    res.send(`
      ✅ Student <strong>${name}</strong> added successfully!<br>
      <img src="${photoUrl}" width="200"/><br>
      <a href="/">Back to Form</a>
    `);
  } catch (err) {
    console.error('Error:', err);
    res.status(500).send('Error saving record. Check logs.');
  }
});

// Start server
app.listen(port, '0.0.0.0', () => {
  console.log(`🚀 Server running on http://localhost:${port}`);
});

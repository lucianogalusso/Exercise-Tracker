const express = require('express')
const app = express()
const cors = require('cors')
const mongoose = require('mongoose');
const moment = require('moment');

require('dotenv').config()

app.use(cors())
app.use(express.static('public'))
app.get('/', (req, res) => {
  res.sendFile(__dirname + '/views/index.html')
});

app.use(express.urlencoded({ extended: true }));

mongoose.connect(process.env.MONGO_URI, { useNewUrlParser: true, useUnifiedTopology: true });

const Schema = mongoose.Schema;

const userSchema = new Schema({
  username: { type: String, required: true }
});

const USER = mongoose.model("User", userSchema);

const exerciseSchema = new Schema({
  userId: { type: Schema.Types.ObjectId, ref: 'User', required: true }, // Referencia al _id del usuario
  description: String,
  duration: Number,
  date: String
});

const EXERCISE = mongoose.model("Exercise", exerciseSchema);

  const logSchema = new Schema({
    userId: { type: Schema.Types.ObjectId, ref: 'User', required: true }, // Referencia al _id del usuario
    count: { type: Number, default: 0 },
    log: [{ type: Schema.Types.ObjectId, ref: 'Exercise' }]
  });

const LOG = mongoose.model("Log", logSchema);


app.post('/api/users', function(req, res) {

  const username = req.body.username;
  if (username === undefined)
    return res.json({ error : "invalid username"});

  let user = new USER({
    username: username
  });

  user.save()
    .then((savedUser) => {
      return res.json(savedUser);
    })
    .catch((err) => {
      return res.json(err);
    });

});

app.get('/api/users', function(req, res) {

  USER.find()
    .then((users) => {
      if (!users) 
        return res.json([]);
      return res.json(users);
    })
    .catch((err) => {
      return res.json(err);
    });

});

app.post('/api/users/:_id/exercises', function(req, res) {

  const id = req.params._id;
  if (id === undefined)
    return res.json({ error : "invalid id"});

  //hacer get de user
  USER.findById(id)
    .then((userNew) => {
      if (!userNew) 
        return res.json({ error: "invalid id" });

      let description = req.body.description;
      if (description === undefined || typeof description !== 'string')
        description = "";
      
      let duration = req.body.duration;
      if (duration === undefined)
        duration = 0;
      else
        duration = Number(duration);

      let date = req.body.date;
      date = new Date(date);
      if (date.toString() === 'Invalid Date')
        date = new Date();
      date = date.toDateString();

      let exercise = new EXERCISE({
        userId: id,
        description: description,
        duration: duration,
        date: date
      });

      exercise.save()
        .then((savedExercise) => {
          let returnObj = {
            username: userNew.username,
            description: description,
            duration: duration,
            date: date,
            _id: id
          }
          // Actualizar o crear log (upsert)
          const updateData = {
            $inc: { count: 1 },
            $push: { log: savedExercise._id }
          };
          LOG.findOneAndUpdate({ userId: id }, updateData, { upsert: true })
            .then(log => {
              return res.json(returnObj);
            })
            .catch(err => {
              return res.json(err);
            });
        })
        .catch((err) => {
          return res.json(err);
        });
    })
    .catch((err) => {
      return res.json(err);
    });

});

app.get('/api/users/:_id/logs', function(req, res) {

  const id = req.params._id;
  if (id === undefined)
    return res.json({ error : "invalid id"});

  let from = req.query.from;
  if (from === undefined || !moment(from, 'YYYY-MM-DD', true).isValid())
    from = null;
  let to = req.query.to;
  if (to === undefined || !moment(to, 'YYYY-MM-DD', true).isValid())
    to = null;
  let limit = req.query.limit;
  limit = Number(limit);
  if (isNaN(limit))
    limit = null;

  USER.findById(id)
    .then((user) => {
      if (!user) 
        return res.json({ error : "invalid id"});

      LOG.findOne({ userId: id }).populate('log')
        .then((log) => {
          if (!log) 
            return res.json({ error : "invalid id"});

          let returnObj = {
            username: user.username,
            count: log.count,
            _id: user._id,
            log: []
          };

          if (from !== null || to !== null || limit !== null) {

            let max = log.log.length;
            if (limit !== null && limit < max)
              max = limit;

            console.log(max);

            let i = 0;
            //VER BIEN i Y EL CONTINUE
            while (log.log[i] !== undefined && i < max) {

              let element = log.log[i];
              
              console.log(from);
              console.log(to);
              let date = new Date(element.date);
              let fromDate = from !== null ? new Date(from) : null;
              let toDate = to !== null ? new Date(to) : null;
            
              if (fromDate && date < fromDate) {
                i++;
                continue;
              }
              if (toDate && date > toDate) {
                i++;
                continue;
              }
              
              returnObj.log.push(element);
              i++;
            }
            
          } else 
            returnObj.log = log.log;
          
          return res.json(returnObj);
        })
        .catch((err) => {
          return res.json(err);
        });
    })
    .catch((err) => {
      return res.json(err);
    });

});

const listener = app.listen(process.env.PORT || 3000, () => {
  console.log('Your app is listening on port ' + listener.address().port)
})

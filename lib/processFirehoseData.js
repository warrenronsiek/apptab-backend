const aws = require('aws-sdk');
const s3 = new aws.S3();
const crypto = require('crypto');
import {flattenDeep} from 'lodash'

const processFirehoseData = function (event, context, callback) {
  const now = new Date();
  const s3writer = (entry, tableName) => {
    return s3.putObject({
      Body: entry,
      Key: `${tableName}/${now.getMonth()}/${now.getDay()}/${now.getHours()}/${crypto.randomBytes(20).toString('hex')}.json`,
      Bucket: `${process.env.stage}-apptab-formatted-data-bucket`
    }).promise()
  };

  const universalProcessor = processor => payload => {
    const eventTable = JSON.stringify({
      eventId: payload.eventId,
      type: payload.type.toLowerCase(),
      sessionId: payload.sessionId,
      date: payload.date,
      customerId: payload.customerId,
      deviceToken: payload.deviceToken,
    });
    const processed = processor(payload);
    return Promise.all([
      s3writer(eventTable, 'events'),
      ...processed.map(item => item && s3writer(item.payload, item.name))
    ])
  };

  const processLogin = payload => {
    const loginStateTable = JSON.stringify({
      ...payload.state.loginState,
      eventId: payload.eventId,
      date: payload.date
    });
    return [{payload: loginStateTable, name: 'logins'}]
  };

  const processNodeSelected = payload => {
    const visibleNodesTable = JSON.stringify(payload.state.nodes.map(node => ({
      ...node,
      eventId: payload.eventId,
      date: payload.date
    })));
    const sessionTable = JSON.stringify({
      sessionId: payload.sessionId,
      date: payload.date,
      activeNode: payload.state.activeNode.nodeId,
      activeVenue: payload.state.activeNode.venueId
    });
    return [{payload: visibleNodesTable, name: 'nodes'}, {payload: sessionTable, name: 'sessions'}]
  };

  const processPaymentComplete = payload => {
    const paymentTable = JSON.stringify({
      eventId: payload.eventId,
      date: payload.date,
      ...payload.state.additionalCosts,
      ...payload.state.paymentStatus,
    });
    const cart = payload.state.cart.map(item => JSON.stringify({
      eventId: payload.eventId,
      date: payload.date,
      ...item
    }));
    return [{payload: paymentTable, name: 'payments'}, ...cart.map(item => ({payload: item, name: 'cart'}))]
  };

  const processRegistrationStepOne = payload => {
    const registrationTable = JSON.stringify({
      eventId: payload.eventId,
      deviceToken: payload.deviceToken,
      date: payload.date,
      ...payload.state.registerState,
    });
    return [{payload: registrationTable, name: 'registrations'}]
  };

  const processRegistrationComplete = payload => {
    const registrationCompleteTable = JSON.stringify({
      eventId: payload.eventId,
      deviceToken: payload.deviceToken,
      customerId: payload.customerId,
      date: payload.date,
      ...payload.state.registerState
    });
    return [{payload: registrationCompleteTable, name: 'registrationComplete'}]
  };

  const defaultProcessor = payload => {
    return []
  };

  const s3writes = event.records.map(record => {
    const payload = JSON.parse((Buffer.from(record.data, 'base64')).toString('ascii'));
    switch (payload.type) {
      case 'Login':
        return universalProcessor(processLogin)(payload);
      case 'NodeSelected':
        return universalProcessor(processNodeSelected)(payload);
      case 'PaymentComplete':
        return universalProcessor(processPaymentComplete)(payload);
      case 'RegistrationStepOne':
        return universalProcessor(processRegistrationStepOne)(payload);
      case 'RegistrationComplete':
        return universalProcessor(processRegistrationComplete)(payload);
      default:
        return universalProcessor(defaultProcessor)(payload);
    }
  });

  Promise.all(flattenDeep(s3writes))
    .then(() => callback(null, {records: event.records.map(record => ({...record, result: 'Ok'}))}))
    .catch(err => {
      console.log(err);
      callback(err)
    })
};

export {processFirehoseData}
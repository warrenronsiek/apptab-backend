const aws = require('aws-sdk');
const s3 = new aws.S3();
const crypto = require('crypto');
import {flattenDeep} from 'lodash'

const processFirehoseData = function (event, context, callback) {
  console.log(event);
  const now = new Date();
  const s3writer = (entry, tableName) => {
    return s3.putObject({
      Body: entry,
      Key: `${tableName}/${now.getFullYear()}/${now.getMonth()}/${now.getDay()}/${now.getHours()}/${crypto.randomBytes(20).toString('hex')}.json`,
      Bucket: `${process.env.stage}-apptab-formatted-data-bucket`
    }).promise()
  };

  const universalProcessor = processor => payload => {
    const eventTable = JSON.stringify({
      eventId: payload.eventId,
      type: payload.type.toLowerCase(),
      sessionId: payload.sessionId,
      date: payload.date,
      customerId: payload.customerId
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
      date: payload.date,
      deviceToken: payload.deviceToken.token,
      os: payload.deviceToken.os
    });
    return [{payload: loginStateTable, name: 'logins'}]
  };

  const processVenueSelected = payload => {
    const venueTable = JSON.stringify({
      eventId: payload.eventId,
      date: payload.date,
      deviceToken: payload.deviceToken.token,
      os: payload.deviceToken.os,
      venueId: payload.state.activeVenue.venueId,
      venueName: payload.state.activeVenue.venueName,
      venueAddress: payload.state.activeVenue.address
    });
    return [{payload: venueTable, name: 'venues'}]
  };

  const processNodeSelected = payload => {
    const visibleNodes = payload.state.nodes.viewableNodes.reduce((arr, nodeChunk) => {
      nodeChunk.data.forEach(node => arr.push(node));
      return arr
    }, []);
    const visibleNodesTable = visibleNodes.map(node => ({
      ...node,
      eventId: payload.eventId,
      date: payload.date
    }));
    const sessionTable = JSON.stringify({
      sessionId: payload.sessionId,
      date: payload.date,
      activeNode: payload.state.activeNode.nodeId,
      activeVenue: payload.state.activeNode.venueId
    });
    return [...visibleNodesTable.map(node => ({payload: JSON.stringify(node), name: 'nodes'})), {
      payload: sessionTable,
      name: 'sessions'
    }]
  };

  const processPaymentComplete = payload => {
    const paymentTable = JSON.stringify({
      eventId: payload.eventId,
      transactionId: payload.state.cart.transactionId,
      tip: payload.state.cart.costs.totalTip,
      tax: payload.state.cart.costs.totalTax,
      subtotal: payload.state.cart.costs.totalCart,
      total: payload.state.cart.costs.totalCost,
      date: payload.date,
      ...payload.state.additionalCosts,
      ...payload.state.paymentStatus,
    });
    const cart = payload.state.cart.items.map(item => JSON.stringify({
      ...item,
      eventId: payload.eventId,
      transactionId: payload.state.cart.transactionId,
      date: payload.date,
      itemOptions: (item.itemOptions === 'NULL') ? [] : item.itemOptions,
      price: parseInt(item.price)
    }));
    return [{payload: paymentTable, name: 'payments'}, ...cart.map(item => ({payload: item, name: 'cart'}))]
  };

  const processRegistrationStepOne = payload => {
    const registrationTable = JSON.stringify({
      eventId: payload.eventId,
      deviceToken: payload.deviceToken.token,
      date: payload.date,
      ...payload.state.registerState,
    });
    return [{payload: registrationTable, name: 'registrations'}]
  };

  const processRegistrationComplete = payload => {
    const registrationCompleteTable = JSON.stringify({
      eventId: payload.eventId,
      deviceToken: payload.deviceToken.token,
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
      case 'VenueSelected':
        return universalProcessor(processVenueSelected)(payload);
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
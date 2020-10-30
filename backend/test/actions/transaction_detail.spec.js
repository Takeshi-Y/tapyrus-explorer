const supertest = require('supertest');
const assert = require('assert');
const app = require('../../server');
require('../../actions/transaction_detail');
const electrs = require('../../libs/electrs');

const sinon = require('sinon');

describe('GET /transaction/:txid return type check', function () {
  it('type check', function (done) {
    supertest(app)
      .get(
        '/transaction/3a46acee8ac1434ca5f17f7b3626142de71a003f5e1e39a7abced3e2a7b94f2b'
      )
      .expect(200)
      .expect('Content-Type', /json/)
      .end(function (err, res) {
        if (err) done(err);
        const transaction = res.body;

        assert.ok(transaction.txid);
        assert.ok(transaction.hash);
        assert.ok(transaction.features);
        assert.ok(transaction.size);
        assert.ok(transaction.vsize);
        assert.ok(transaction.weight);
        assert.ok(!transaction.locktime);
        assert.ok(transaction.vin);
        assert.ok(transaction.vout);
        assert.ok(transaction.hex);
        assert.ok(transaction.blockhash);
        assert.ok(transaction.confirmations);
        assert.ok(transaction.time);
        assert.ok(transaction.blocktime);
        assert.ok(transaction.vinRaw);
        done();
      });
  });
});

function isEmpty(obj) {
  for (var key in obj) {
    if (obj.hasOwnProperty(key)) return false;
  }
  return true;
}

describe('GET /transaction/:txid with sinon.stub', function () {
  beforeEach(() => {
    sinon
      .stub(electrs.blockchain.transaction, 'get')
      .withArgs(
        'a82d9931eece4f2504691810db4a11d406a6eb2345b739fc35bb4f993d85e7c8',
        true
      )
      .resolves({
        txid:
          'a82d9931eece4f2504691810db4a11d406a6eb2345b739fc35bb4f993d85e7c8',
        hash:
          'fa305c408bbedc3043658845b1605b0f02e89dc471b9c86d1b74a7b8b1b9d531',
        features: 1,
        size: 90,
        vsize: 90,
        weight: 360,
        locktime: 0,
        vin: [{ coinbase: '08f2770101', sequence: 9672954294 }],
        vout: [
          {
            value: 50,
            n: 0,
            scriptPubKey: {
              asm:
                'OP_DUP OP_HASH160 6713b478d99432aac667b7d8e87f9d06edca03bb OP_EQUALVERIFY OP_CHECKSIG',
              hex: 'ac667b7d8e87f9d06edca03bb88ac76a9146713b478d99432a',
              reqSigs: 1,
              type: 'pubkeyhash',
              addresses: ['1AQ2CtG3jho78SrEzKe3vf6dxcEkJt5nzA']
            }
          }
        ],
        hex:
          '01000000010000000000000000000000000000000000000000000000000000000000000000e37700000502e3770101ffffffff0100f2052a010000001976a9146713b478d99432aac667b7d8e87f9d06edca03bb88ac00000000',
        blockhash:
          '69b5964caf1e85883dfe60ddf4ace9e301e7b21a923f8fc82f47b0deae366a2b',
        confirmations: 28,
        time: 1599509432,
        blocktime: 1599509432
      });
  });

  afterEach(() => {
    sinon.restore();
  });

  it('/transaction/:txid', function (done) {
    supertest(app)
      .get(
        '/transaction/a82d9931eece4f2504691810db4a11d406a6eb2345b739fc35bb4f993d85e7c8'
      )
      .expect(200)
      .expect('Content-Type', /json/)
      .end(function (err, res) {
        if (err) done(err);

        const transaction = res.body;
        assert.strictEqual(
          transaction.txid,
          'a82d9931eece4f2504691810db4a11d406a6eb2345b739fc35bb4f993d85e7c8'
        );
        assert.strictEqual(
          transaction.hash,
          'fa305c408bbedc3043658845b1605b0f02e89dc471b9c86d1b74a7b8b1b9d531'
        );
        assert.strictEqual(transaction.features, 1);
        assert.strictEqual(transaction.size, 90);
        assert.strictEqual(transaction.vsize, 90);
        assert.strictEqual(transaction.weight, 360);
        assert.strictEqual(transaction.locktime, 0);
        assert.strictEqual(
          transaction.hex,
          '01000000010000000000000000000000000000000000000000000000000000000000000000e37700000502e3770101ffffffff0100f2052a010000001976a9146713b478d99432aac667b7d8e87f9d06edca03bb88ac00000000'
        );
        assert.strictEqual(
          transaction.blockhash,
          '69b5964caf1e85883dfe60ddf4ace9e301e7b21a923f8fc82f47b0deae366a2b'
        );
        assert.strictEqual(transaction.time, 1599509432);
        assert.strictEqual(transaction.blocktime, 1599509432);

        assert.strictEqual(transaction.vin[0].coinbase, '08f2770101');
        assert.strictEqual(transaction.vin[0].sequence, 9672954294);

        assert.strictEqual(transaction.vout[0].value, 50);
        assert.strictEqual(transaction.vout[0].n, 0);
        assert.strictEqual(
          transaction.vout[0].scriptPubKey.asm,
          'OP_DUP OP_HASH160 6713b478d99432aac667b7d8e87f9d06edca03bb OP_EQUALVERIFY OP_CHECKSIG'
        );
        assert.strictEqual(
          transaction.vout[0].scriptPubKey.hex,
          'ac667b7d8e87f9d06edca03bb88ac76a9146713b478d99432a'
        );
        assert.strictEqual(transaction.vout[0].scriptPubKey.reqSigs, 1);
        assert.strictEqual(transaction.vout[0].scriptPubKey.type, 'pubkeyhash');
        assert.strictEqual(
          transaction.vout[0].scriptPubKey.addresses[0],
          '1AQ2CtG3jho78SrEzKe3vf6dxcEkJt5nzA'
        );

        assert.strictEqual(transaction.vinRaw.length, 1);
        assert.strictEqual(isEmpty(transaction.vinRaw[0]), true);

        done();
      });
  });
});

describe('GET /transaction/:txid/rawData return type check', function () {
  it('type check', function (done) {
    supertest(app)
      .get(
        '/transaction/3a46acee8ac1434ca5f17f7b3626142de71a003f5e1e39a7abced3e2a7b94f2b/rawData'
      )
      .expect(200)
      .expect('Content-Type', /json/)
      .end(function (err, res) {
        if (err) done(err);
        const rawTransaction = JSON.parse(res.text);
        assert.ok(rawTransaction);
        assert.notEqual(rawTransaction.length, 0);
        assert.equal(typeof rawTransaction, 'string');
        done();
      });
  });
});

describe('GET /transaction/:txid/rawData with sinon.stub', function () {
  beforeEach(() => {
    sinon
      .stub(electrs.blockchain.transaction, 'get')
      .withArgs(
        'a82d9931eece4f2504691810db4a11d406a6eb2345b739fc35bb4f993d85e7c8'
      )
      .resolves(
        '01000000010000000000000000000000000000000000000000000000000000000000000000c57700000502c5770101ffffffff0100f2052a010000001976a9146713b478d99432aac667b7d8e87f9d06edca03bb88ac00000000'
      );
  });

  afterEach(() => {
    sinon.restore();
  });

  it('/transaction/:txid/rawData', function (done) {
    supertest(app)
      .get(
        '/transaction/a82d9931eece4f2504691810db4a11d406a6eb2345b739fc35bb4f993d85e7c8/rawData'
      )
      .expect(200)
      .expect('Content-Type', /json/)
      .end(function (err, res) {
        if (err) done(err);

        const rawTransaction = res.body;
        assert.strictEqual(
          rawTransaction,
          '01000000010000000000000000000000000000000000000000000000000000000000000000c57700000502c5770101ffffffff0100f2052a010000001976a9146713b478d99432aac667b7d8e87f9d06edca03bb88ac00000000'
        );
        done();
      });
  });

  afterEach(function () {
    sinon.restore();
  });
});

describe('GET /transaction/:txid/get return type check', function () {
  it('type check', function (done) {
    supertest(app)
      .get(
        '/transaction/3a46acee8ac1434ca5f17f7b3626142de71a003f5e1e39a7abced3e2a7b94f2b/get'
      )
      .expect(200)
      .expect('Content-Type', /json/)
      .end(function (err, res) {
        if (err) done(err);
        const getTransaction = JSON.parse(res.text);
        assert.ok(getTransaction.txid);
        assert.ok(getTransaction.hash);
        assert.ok(getTransaction.features);
        assert.ok(getTransaction.size);
        assert.ok(getTransaction.vsize);
        assert.ok(getTransaction.weight);
        assert.ok(!getTransaction.locktime);
        assert.ok(getTransaction.vin);
        assert.ok(getTransaction.vout);
        assert.ok(getTransaction.hex);
        assert.ok(getTransaction.blockhash);
        assert.ok(getTransaction.confirmations);
        assert.ok(getTransaction.time);
        assert.ok(getTransaction.blocktime);

        done();
      });
  });
});

describe('GET /transaction/:txid/get with sinon.stub', function () {
  beforeEach(() => {
    sinon
      .stub(electrs.blockchain.transaction, 'get')
      .withArgs(
        'a82d9931eece4f2504691810db4a11d406a6eb2345b739fc35bb4f993d85e7c8',
        true
      )
      .resolves({
        txid:
          'a82d9931eece4f2504691810db4a11d406a6eb2345b739fc35bb4f993d85e7c8',
        hash:
          'fa305c408bbedc3043658845b1605b0f02e89dc471b9c86d1b74a7b8b1b9d531',
        features: 1,
        size: 90,
        vsize: 90,
        weight: 360,
        locktime: 0,
        vin: [{ coinbase: '08f2770101', sequence: 9672954294 }],
        vout: [
          {
            value: 50,
            n: 0,
            scriptPubKey: {
              asm:
                'OP_DUP OP_HASH160 6713b478d99432aac667b7d8e87f9d06edca03bb OP_EQUALVERIFY OP_CHECKSIG',
              hex: 'ac667b7d8e87f9d06edca03bb88ac76a9146713b478d99432a',
              reqSigs: 1,
              type: 'pubkeyhash',
              addresses: ['1AQ2CtG3jho78SrEzKe3vf6dxcEkJt5nzA']
            }
          }
        ],
        hex:
          '01000000010000000000000000000000000000000000000000000000000000000000000000e37700000502e3770101ffffffff0100f2052a010000001976a9146713b478d99432aac667b7d8e87f9d06edca03bb88ac00000000',
        blockhash:
          '69b5964caf1e85883dfe60ddf4ace9e301e7b21a923f8fc82f47b0deae366a2b',
        confirmations: 28,
        time: 1599509432,
        blocktime: 1599509432
      });
  });

  afterEach(() => {
    sinon.restore();
  });

  it('/transaction/:txid/get', function (done) {
    supertest(app)
      .get(
        '/transaction/a82d9931eece4f2504691810db4a11d406a6eb2345b739fc35bb4f993d85e7c8/get'
      )
      .expect(200)
      .expect('Content-Type', /json/)
      .end(function (err, res) {
        if (err) return done(err);

        const getTransaction = res.body;

        assert.strictEqual(
          getTransaction.txid,
          'a82d9931eece4f2504691810db4a11d406a6eb2345b739fc35bb4f993d85e7c8'
        );
        assert.strictEqual(
          getTransaction.hash,
          'fa305c408bbedc3043658845b1605b0f02e89dc471b9c86d1b74a7b8b1b9d531'
        );
        assert.strictEqual(getTransaction.features, 1);
        assert.strictEqual(getTransaction.size, 90);
        assert.strictEqual(getTransaction.vsize, 90);
        assert.strictEqual(getTransaction.weight, 360);
        assert.strictEqual(getTransaction.locktime, 0);
        assert.strictEqual(
          getTransaction.hex,
          '01000000010000000000000000000000000000000000000000000000000000000000000000e37700000502e3770101ffffffff0100f2052a010000001976a9146713b478d99432aac667b7d8e87f9d06edca03bb88ac00000000'
        );
        assert.strictEqual(
          getTransaction.blockhash,
          '69b5964caf1e85883dfe60ddf4ace9e301e7b21a923f8fc82f47b0deae366a2b'
        );
        assert.strictEqual(getTransaction.time, 1599509432);
        assert.strictEqual(getTransaction.blocktime, 1599509432);

        assert.strictEqual(getTransaction.vin[0].coinbase, '08f2770101');
        assert.strictEqual(getTransaction.vin[0].sequence, 9672954294);

        assert.strictEqual(getTransaction.vout[0].value, 50);
        assert.strictEqual(getTransaction.vout[0].n, 0);
        assert.strictEqual(
          getTransaction.vout[0].scriptPubKey.asm,
          'OP_DUP OP_HASH160 6713b478d99432aac667b7d8e87f9d06edca03bb OP_EQUALVERIFY OP_CHECKSIG'
        );
        assert.strictEqual(
          getTransaction.vout[0].scriptPubKey.hex,
          'ac667b7d8e87f9d06edca03bb88ac76a9146713b478d99432a'
        );
        assert.strictEqual(getTransaction.vout[0].scriptPubKey.reqSigs, 1);
        assert.strictEqual(
          getTransaction.vout[0].scriptPubKey.type,
          'pubkeyhash'
        );
        assert.strictEqual(
          getTransaction.vout[0].scriptPubKey.addresses[0],
          '1AQ2CtG3jho78SrEzKe3vf6dxcEkJt5nzA'
        );

        done();
      });
  });
});

const supertest = require('supertest');
const assert = require('assert');
const app = require('../../server');
require('../../actions/address_detail');
const electrs = require('../../libs/electrs');

const sinon = require('sinon');

describe('GET /address return type check', function () {
  it('/address', function (done) {
    this.timeout(5000);
    supertest(app)
      .get('/address/1EH5UTrkqwzy56tG8kSctVeTDHLkhjg7g')
      .query({ perPage: '25', page: 1 })
      .expect(200)
      .expect('Content-Type', /json/)
      .end(function (err, res) {
        if (err) done(err);
        const addressResponse = JSON.parse(res.text);
        assert.ok(addressResponse[0].toString());
        assert.ok(addressResponse[1]);
        assert.ok(addressResponse[2].toString());
        assert.ok(addressResponse[3].toString());

        assert.strictEqual(typeof addressResponse[0], 'number');
        assert.ok(Array.isArray(addressResponse[1]));
        assert.strictEqual(typeof addressResponse[2], 'number');
        assert.strictEqual(typeof addressResponse[3], 'number');

        done();
      });
  });
});

describe('GET /address with sinon.stub', function () {
  beforeEach(() => {
    sinon
      .stub(electrs.blockchain.scripthash, 'get_balance')
      .withArgs(
        '38bf47ffa420b5ff50a3ca04411a4f4b3c7f6ea63a47732674501ab67776d923'
      )
      .resolves([{ confirmed: 109988776, unconfirmed: 0 }]);
  });

  afterEach(() => {
    sinon.restore();
  });

  it('/address', function (done) {
    this.timeout(5000);
    supertest(app)
      .get('/address/1AX2nLM8dnZH3g5tT2hDAJ4Y3UiYwqkHNX')
      .query({ perPage: '25', page: 1 })
      .expect(200)
      .expect('Content-Type', /json/)
      .end(function (err, res) {
        if (err) done(err);

        assert.strictEqual(res.body[0], 109988776);

        supertest(app)
          .get('/address/1AX2nLM8dnZH3g5tT2hDAJ4Y3UiYwqkHNX')
          .query({ perPage: '25', page: res.body[3] / 25 + 1 })
          .expect(200)
          .expect('Content-Type', /json/)
          .end(function (transErr, transRes) {
            if (transErr) done(transErr);

            const transaction = transRes.body[1][(res.body[3] % 25) - 1];

            assert.strictEqual(
              transaction.txid,
              '8f1458a97dba789e669237b2392b26d6441810fe627dffee526affd65ec1625c'
            );
            assert.strictEqual(
              transaction.hash,
              '2cef097c8c6e8680c01ad522d6887144134442c83e70493530417773989dfa8e'
            );
            assert.strictEqual(transaction.time, 1597121680);
            assert.strictEqual(transaction.blocktime, 1597121680);
            assert.strictEqual(transaction.blockheight, 22655);
            assert.strictEqual(
              transaction.blockhash,
              '9c120337f9152d373b26f0a658474dd2e3a857ac85704c8505c63503ef48aa3f'
            );
            assert.strictEqual(
              transaction.hex,
              '0100000001fb342fb127ad757dd33d939a0cd0568993a6f6bbe6e7342f43da8079f6444192000000006a47304402203253912c5ba35c74cce8d567525a4d9ac2088f8ae08207fde7f78d78213f231c022062c3e4aabb834202b7ef474ecf861d919a8431e1460722c20fd00d42b790ad5f01210293026d9250a44cc454372df7e471c87e510df936a32ec66290e60dbc61ce622afeffffff022c60bb03000000001976a9146867191ea00a741f846e712670d4006000ab33b788ace682761c010000001976a91417c52451a4b21e0867e3865e679497799ee85dda88ac7e580000'
            );
            assert.strictEqual(transaction.size, 225);
            assert.strictEqual(transaction.vsize, 225);
            assert.strictEqual(transaction.weight, 900);
            assert.strictEqual(transaction.locktime, 22654);
            assert.strictEqual(transaction.features, 1);

            assert.strictEqual(
              transaction.inputs[0],
              '19fiprs1KM6ZCtEZxb3mw5XXiesqqySE59'
            );
            assert.strictEqual(
              transaction.inputs[1],
              '1LHunchH9PsGHM5cKUcXHfAsQjPdWBDqmx'
            );

            assert.strictEqual(
              transaction.vin[0].txid,
              '924144f67980da432f34e7e6bbf6a6938956d00c9a933dd37d75ad27b12f34fb'
            );
            assert.strictEqual(transaction.vin[0].vout, 0);
            assert.strictEqual(transaction.vin[0].sequence, 4294967294);
            assert.strictEqual(
              transaction.vin[0].scriptSig.asm,
              '304402203253912c5ba35c74cce8d567525a4d9ac2088f8ae08207fde7f78d78213f231c022062c3e4aabb834202b7ef474ecf861d919a8431e1460722c20fd00d42b790ad5f[ALL] 0293026d9250a44cc454372df7e471c87e510df936a32ec66290e60dbc61ce622a'
            );
            assert.strictEqual(
              transaction.vin[0].scriptSig.hex,
              '47304402203253912c5ba35c74cce8d567525a4d9ac2088f8ae08207fde7f78d78213f231c022062c3e4aabb834202b7ef474ecf861d919a8431e1460722c20fd00d42b790ad5f01210293026d9250a44cc454372df7e471c87e510df936a32ec66290e60dbc61ce622a'
            );

            assert.strictEqual(transaction.vout[0].value, 0.626115);
            assert.strictEqual(transaction.vout[0].n, 0);
            assert.strictEqual(
              transaction.vout[0].scriptPubKey.asm,
              'OP_DUP OP_HASH160 6867191ea00a741f846e712670d4006000ab33b7 OP_EQUALVERIFY OP_CHECKSIG'
            );
            assert.strictEqual(
              transaction.vout[0].scriptPubKey.hex,
              '76a9146867191ea00a741f846e712670d4006000ab33b788ac'
            );
            assert.strictEqual(transaction.vout[0].scriptPubKey.reqSigs, 1);
            assert.strictEqual(
              transaction.vout[0].scriptPubKey.type,
              'pubkeyhash'
            );
            assert.strictEqual(
              transaction.vout[0].scriptPubKey.addresses[0],
              '1AX2nLM8dnZH3g5tT2hDAJ4Y3UiYwqkHNX'
            );

            assert.strictEqual(transaction.vout[1].value, 47.72496102);
            assert.strictEqual(transaction.vout[1].n, 1);
            assert.strictEqual(
              transaction.vout[1].scriptPubKey.asm,
              'OP_DUP OP_HASH160 17c52451a4b21e0867e3865e679497799ee85dda OP_EQUALVERIFY OP_CHECKSIG'
            );
            assert.strictEqual(
              transaction.vout[1].scriptPubKey.hex,
              '76a91417c52451a4b21e0867e3865e679497799ee85dda88ac'
            );
            assert.strictEqual(transaction.vout[1].scriptPubKey.reqSigs, 1);
            assert.strictEqual(
              transaction.vout[1].scriptPubKey.type,
              'pubkeyhash'
            );
            assert.strictEqual(
              transaction.vout[1].scriptPubKey.addresses[0],
              '13Agi52XAq2KvRFfmKy8neADuFkio8yCFS'
            );

            done();
          });
      });
  });
});

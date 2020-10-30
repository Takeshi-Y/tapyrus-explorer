const supertest = require('supertest');
const assert = require('assert');
const app = require('../../server');
require('../../actions/block_list');
const electrs = require('../../libs/electrs');

const sinon = require('sinon');

describe('GET /blocks return type check', function () {
  it('/blocks', function (done) {
    this.timeout(5000);
    supertest(app)
      .get('/blocks')
      .query({ perPage: '25', page: 1 })
      .expect(200)
      .expect('Content-Type', /json/)
      .end(function (err, res) {
        if (err) done(err);
        const blocks = res.body.results;

        assert.equal(blocks.length, 25);

        assert.ok(blocks[0].hash);
        assert.ok(blocks[0].confirmations);
        assert.ok(blocks[0].strippedsize);
        assert.ok(blocks[0].height);
        assert.ok(blocks[0].weight);
        assert.ok(blocks[0].size);
        assert.ok(blocks[0].merkleroot);
        assert.ok(blocks[0].immutablemerkleroot);
        assert.ok(blocks[0].previousblockhash);
        assert.ok(blocks[0].nextblockhash);
        assert.ok(blocks[0].features);
        assert.ok(blocks[0].featuresHex);
        assert.ok(blocks[0].time);
        assert.ok(blocks[0].mediantime);
        assert.ok(!blocks[0].xfieldType);
        assert.ok(blocks[0].proof);
        assert.ok(blocks[0].tx);
        assert.ok(blocks[0].nTx);

        done();
      });
  });
});

describe('GET /blocks and then call individual block using /block/:blockHash with stubbed electrs', function () {
  beforeEach(() => {
    sinon
      .stub(electrs.blockchain.block, 'header')
      .resolves(
        '0100000075adc0f804073eee1c74988e1e1bd83c85f987e34a95fd714813e379a724e85f97d679310470c26fdfaed7167075c7a8a1fa34d9c67be9c45c246281c15ffb231d0ef017e1b2147099d84709bcc0fbe89ef4d579fa8a95192ce89671765ec90459d4455f0040e7f72ce96424573b0d18f707333d02a2bc546491ba197c3af7b52d559eb55765d00a1e99d6ef4175ec4aae134c6b496a87c78d3a41ed77c7c2fd4ba684cd4abd'
      );
  });

  afterEach(() => {
    sinon.restore();
  });

  it('/blocks', function (done) {
    supertest(app)
      .get('/blocks')
      .query({ perPage: '25', page: 1 })
      .expect(200)
      .expect('Content-Type', /json/)
      .end(function (err, res) {
        if (err) done(err);
        else {
          assert.equal(res.body.results.length, 25);

          supertest(app)
            .get(`/block/${res.body.results[0].hash}`)
            .expect('Content-Type', /json/)
            .expect(200)
            .end(function (err, res) {
              if (err) done(err);

              const body = res.body;
              assert.strictEqual(
                body.blockHash,
                'b9deaab16abe5f28967aebd0c6e94ce18c8309dec39816ea883885265b681f7c'
              );
              assert.strictEqual(body.ntx, 1);
              assert.strictEqual(body.height, 27018);
              assert.strictEqual(body.timestamp, 1598411865);
              assert.strictEqual(
                body.proof,
                'e7f72ce96424573b0d18f707333d02a2bc546491ba197c3af7b52d559eb55765d00a1e99d6ef4175ec4aae134c6b496a87c78d3a41ed77c7c2fd4ba684cd4abd'
              );
              assert.strictEqual(body.sizeBytes, 261);
              assert.strictEqual(body.version, 1);
              assert.strictEqual(
                body.merkleRoot,
                '23fb5fc18162245cc4e97bc6d934faa1a8c7757016d7aedf6fc270043179d697'
              );
              assert.strictEqual(
                body.immutableMerkleRoot,
                '04c95e767196e82c19958afa79d5f49ee8fbc0bc0947d8997014b2e117f00e1d'
              );
              assert.strictEqual(
                body.previousBlock,
                '5fe824a779e3134871fd954ae387f9853cd81b1e8e98741cee3e0704f8c0ad75'
              );
              assert.strictEqual(
                body.nextBlock,
                '6521d05740a995a351c474db228b5c399bd89aaed23c115ee597bfd0b749b89d'
              );
              done();
            });
        }
      });
  });
});

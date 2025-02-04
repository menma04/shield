import Lab from '@hapi/lab';
import * as R from 'ramda';
import Sinon from 'sinon';
import Code from 'code';
import Faker from 'faker';
import { factory } from 'typeorm-seeding';
import { lab } from '../../setup';
import { Group } from '../../../src/model/group';
import { User } from '../../../src/model/user';
import * as Resource from '../../../src/app/group/resource';
import * as PolicyResource from '../../../src/app/policy/resource';
import CasbinSingleton from '../../../src/lib/casbin';
import * as Config from '../../../src/config/config';

exports.lab = Lab.script();
const Sandbox = Sinon.createSandbox();

lab.afterEach(() => {
  Sandbox.restore();
});

lab.experiment('Group::resource', () => {
  lab.experiment('get group by id', () => {
    let group;

    lab.beforeEach(async () => {
      group = await factory(Group)().create();
    });

    lab.afterEach(() => {
      Sandbox.restore();
    });

    lab.test(
      'should get group by id along with attributes and policies',
      async () => {
        const policies = <any>[{ policy: '' }];
        const getPoliciesBySubjectStub = Sandbox.stub(
          PolicyResource,
          'getPoliciesBySubject'
        ).resolves(policies);

        const groupList = [group];
        const listStub = Sandbox.stub(Resource, 'list').resolves(groupList);

        const response = await Resource.get(group.id);
        Code.expect(response).to.equal({ ...group, policies });
        Sandbox.assert.calledWithExactly(
          getPoliciesBySubjectStub,
          {
            group: group.id
          },
          {}
        );
        Sandbox.assert.calledWithExactly(listStub, { group: group.id }, '');
      }
    );

    lab.test(
      'should return undefined response if group is not found',
      async () => {
        try {
          const listStub = Sandbox.stub(Resource, 'list').resolves([]);
          await Resource.get(Faker.random.uuid());
          Sandbox.assert.calledOnce(listStub);
        } catch (e) {
          Code.expect(e.output.statusCode).to.equal(404);
        }
      }
    );
  });

  lab.experiment('create group', () => {
    lab.afterEach(() => {
      Sandbox.restore();
    });

    lab.test('should create group by id', async () => {
      const payload = <any>{
        displayname: 'Data Engineering',
        groupname: 'de',
        metadata: {
          name: 'Data Engineering',
          privacy: 'private'
        },
        policies: [{ operation: 'create' }],
        attributes: [{ entity: 'gojek' }]
      };
      const groupId = Faker.random.uuid();

      const checkSubjectHasAccessToCreateAttributesMappingStub = Sandbox.stub(
        Resource,
        'checkSubjectHasAccessToCreateAttributesMapping'
      ).returns(<any>true);

      const upsertGroupAndAttributesMappingStub = Sandbox.stub(
        Resource,
        'upsertGroupAndAttributesMapping'
      ).returns(<any>true);

      const groupSaveStub = Sandbox.stub(Group, 'save').returns(<any>{
        id: groupId,
        ...payload
      });

      const bulkUpsertPoliciesForGroupStub = Sandbox.stub(
        Resource,
        'bulkUpsertPoliciesForGroup'
      ).returns(<any>[
        {
          operation: 'create',
          success: true
        }
      ]);

      const getStub = Sandbox.stub(Resource, 'get').returns(<any>{
        id: groupId,
        ...payload
      });

      const user = await factory(User)().create();
      const loggedInUserId = user.id;

      Sandbox.stub(User, 'findOne').resolves(<User>user);

      const response = await Resource.create(payload, loggedInUserId);

      Sandbox.assert.calledWithExactly(
        checkSubjectHasAccessToCreateAttributesMappingStub,
        { user: loggedInUserId },
        payload.attributes
      );

      Sandbox.assert.calledWithExactly(
        checkSubjectHasAccessToCreateAttributesMappingStub,
        { user: loggedInUserId },
        payload.attributes
      );
      Sandbox.assert.calledWithExactly(
        upsertGroupAndAttributesMappingStub,
        groupId,
        payload.attributes,
        user
      );
      Sandbox.assert.calledWithExactly(
        groupSaveStub,
        <any>R.omit(['attributes', 'policies'], payload),
        { data: { user } }
      );
      Sandbox.assert.calledWithExactly(
        bulkUpsertPoliciesForGroupStub,
        groupId,
        payload.policies,
        loggedInUserId
      );
      Sandbox.assert.calledWithExactly(getStub, groupId, loggedInUserId);

      Code.expect(response).to.equal({
        id: groupId,
        ...payload,
        policyOperationResult: [{ operation: 'create', success: true }]
      });
    });
  });

  lab.experiment('update group by id', () => {
    lab.afterEach(() => {
      Sandbox.restore();
    });

    lab.test('should update group by id', async () => {
      const payload = <any>{
        displayname: 'Data Engineering',
        metadata: {
          name: 'Data Engineering',
          privacy: 'private'
        },
        policies: [{ operation: 'create' }],
        attributes: [{ entity: 'gojek' }]
      };
      const groupId = Faker.random.uuid();

      const checkSubjectHasAccessToEditGroupStub = Sandbox.stub(
        Resource,
        'checkSubjectHasAccessToEditGroup'
      ).returns(<any>true);

      const groupSaveStub = Sandbox.stub(Group, 'save').returns(<any>{
        id: groupId,
        ...payload
      });

      const bulkUpsertPoliciesForGroupStub = Sandbox.stub(
        Resource,
        'bulkUpsertPoliciesForGroup'
      ).returns(<any>[
        {
          operation: 'create',
          success: true
        }
      ]);

      const group = {
        id: groupId,
        ...payload
      };
      const user = await factory(User)().create();
      const getStub = Sandbox.stub(Resource, 'get').returns(<any>group);
      Sandbox.stub(User, 'findOne').returns(<any>user);

      const loggedInUserId = user.id;
      const response = await Resource.update(groupId, payload, loggedInUserId);

      Sandbox.assert.calledWithExactly(
        checkSubjectHasAccessToEditGroupStub,
        group,
        payload.attributes,
        loggedInUserId
      );
      Sandbox.assert.calledWithExactly(
        groupSaveStub,
        <any>R.omit(['attributes', 'policies'], { ...payload, id: groupId }),
        { data: { user } }
      );
      Sandbox.assert.calledWithExactly(
        bulkUpsertPoliciesForGroupStub,
        groupId,
        payload.policies,
        loggedInUserId
      );
      Sandbox.assert.calledWithExactly(getStub, groupId, loggedInUserId);
      Sandbox.assert.callCount(getStub, 2);
      Code.expect(response).to.equal({
        id: groupId,
        ...payload,
        policyOperationResult: [{ operation: 'create', success: true }]
      });
    });
  });

  lab.experiment('get list of groups', () => {
    let groups: any, users: any, currentUser: any;

    const sortByDisplayName = R.sortBy(R.propOr(null, 'displayname'));
    const removeExtraKeys = R.map(R.omit(['createdAt', 'updatedAt']));

    const sortMemberPolicies = (results) => {
      const sortByUserId = R.sortBy(R.path(['subject', 'user']));

      return results.map((group) => {
        const sortedPolicies = sortByUserId(group.userPolicies);
        return R.assoc('userPolicies', sortedPolicies, group);
      });
    };

    const parseResults = R.pipe(
      removeExtraKeys,
      sortByDisplayName,
      sortMemberPolicies
    );

    const getMemberPolicy = (user: any, group: any, role: any) => {
      return {
        subject: { user: user.id },
        resource: { group: group.id },
        action: { role }
      };
    };

    lab.beforeEach(async () => {
      // setup data
      const dbUri = Config.get('/postgres').uri;
      const enforcer = await CasbinSingleton.create(dbUri);

      // create 5 groups
      groups = await factory(Group)().createMany(5);
      // create 10 users
      users = await factory(User)().createMany(10);
      currentUser = R.head(users);

      const getId = R.path(['id']);

      const makeUserTeamAdmin = async (user: any, group: any) => {
        const groupId = getId(group);
        const userId = getId(user);

        // eslint-disable-next-line @typescript-eslint/ban-ts-comment
        // @ts-ignore
        await enforcer?.addSubjectGroupingJsonPolicy(
          { user: userId },
          { group: groupId },
          { created_by: user }
        );
        await enforcer?.addJsonPolicy(
          { user: userId },
          { group: groupId },
          { role: 'team.admin' },
          { created_by: user }
        );
      };

      // map 3 groups with gojek, and also with currentUser
      await Promise.all(
        R.take(3, groups).map(async (group) => {
          const groupId = getId(group);
          // eslint-disable-next-line @typescript-eslint/ban-ts-comment
          // @ts-ignore
          await enforcer?.addResourceGroupingJsonPolicy(
            { group: groupId },
            { entity: 'gojek' },
            { created_by: currentUser }
          );

          // eslint-disable-next-line @typescript-eslint/ban-ts-comment
          // @ts-ignore
          await enforcer?.addSubjectGroupingJsonPolicy(
            { user: getId(currentUser) },
            { group: groupId },
            { created_by: currentUser }
          );
        })
      );

      // map 2 groups with gofin
      await Promise.all(
        R.takeLast(2, groups).map(async (group) => {
          // eslint-disable-next-line @typescript-eslint/ban-ts-comment
          // @ts-ignore
          await enforcer?.addResourceGroupingJsonPolicy(
            { group: getId(group) },
            { entity: 'gofin' },
            { created_by: currentUser }
          );
        })
      );

      // add 1,2 users as admin of group[0]
      await Promise.all(
        R.take(2, users).map(async (user) => {
          const group = groups[0];
          await makeUserTeamAdmin(user, group);
        })
      );

      // add 3 users as admin of group[1]
      await Promise.all(
        R.takeLast(3, users).map(async (user) => {
          const group = groups[1];
          await makeUserTeamAdmin(user, group);
        })
      );
    });

    lab.test('should get list of groups', async () => {
      const result = await Resource.list({}, currentUser.id);

      const gojekAttributes = [{ entity: 'gojek' }];
      const gofinAttributes = [{ entity: 'gofin' }];

      const expectedResult = [
        {
          ...groups[0],
          isMember: true,
          memberCount: 2,
          attributes: gojekAttributes,
          userPolicies: []
        },
        {
          ...groups[1],
          isMember: true,
          memberCount: 4,
          attributes: gojekAttributes,
          userPolicies: []
        },
        {
          ...groups[2],
          isMember: true,
          memberCount: 1,
          attributes: gojekAttributes,
          userPolicies: []
        },
        {
          ...groups[3],
          isMember: false,
          memberCount: 0,
          attributes: gofinAttributes,
          userPolicies: []
        },
        {
          ...groups[4],
          isMember: false,
          memberCount: 0,
          attributes: gofinAttributes,
          userPolicies: []
        }
      ];

      const sortedResult = parseResults(result);
      const sortedExpectedResult = parseResults(expectedResult);
      Code.expect(sortedResult).to.equal(<any>sortedExpectedResult);
    });

    lab.test('should get list of groups with filters', async () => {
      const result = await Resource.list(
        { entity: 'gojek', user_role: 'team.admin' },
        currentUser.id
      );

      const gojekAttributes = [{ entity: 'gojek' }];

      const expectedResult = [
        {
          ...groups[0],
          isMember: true,
          memberCount: 2,
          attributes: gojekAttributes,
          userPolicies: [
            getMemberPolicy(users[0], groups[0], 'team.admin'),
            getMemberPolicy(users[1], groups[0], 'team.admin')
          ]
        },
        {
          ...groups[1],
          isMember: true,
          memberCount: 4,
          attributes: gojekAttributes,
          userPolicies: [
            getMemberPolicy(users[7], groups[1], 'team.admin'),
            getMemberPolicy(users[8], groups[1], 'team.admin'),
            getMemberPolicy(users[9], groups[1], 'team.admin')
          ]
        },
        {
          ...groups[2],
          isMember: true,
          memberCount: 1,
          attributes: gojekAttributes,
          userPolicies: []
        }
      ];
      const sortedResult = parseResults(result);
      const sortedExpectedResult = parseResults(expectedResult);
      Code.expect(sortedResult).to.equal(<any>sortedExpectedResult);
    });
  });
});

/*
 * Copyright 2020 Spotify AB
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *     http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

import { CatalogApi } from '@backstage/catalog-client';
import {
  Entity,
  RELATION_MEMBER_OF,
  RELATION_OWNED_BY,
} from '@backstage/catalog-model';
import {
  ApiProvider,
  ApiRegistry,
  IdentityApi,
  identityApiRef,
  ProfileInfo,
  storageApiRef,
} from '@backstage/core';
import { catalogApiRef } from '@backstage/plugin-catalog-react';
import {
  MockStorageApi,
  renderWithEffects,
  wrapInTestApp,
} from '@backstage/test-utils';
import { fireEvent, waitFor } from '@testing-library/react';
import React from 'react';
import { createComponentRouteRef } from '../../routes';
import { CatalogPage } from './CatalogPage';

describe('CatalogPage', () => {
  const catalogApi: Partial<CatalogApi> = {
    getEntities: () =>
      Promise.resolve({
        items: [
          {
            apiVersion: 'backstage.io/v1alpha1',
            kind: 'Component',
            metadata: {
              name: 'Entity1',
            },
            spec: {
              owner: 'tools@example.com',
              type: 'service',
            },
            relations: [
              {
                type: RELATION_OWNED_BY,
                target: { kind: 'Group', name: 'tools', namespace: 'default' },
              },
            ],
          },
          {
            apiVersion: 'backstage.io/v1alpha1',
            kind: 'Component',
            metadata: {
              name: 'Entity2',
            },
            spec: {
              owner: 'not-tools@example.com',
              type: 'service',
            },
            relations: [
              {
                type: RELATION_OWNED_BY,
                target: {
                  kind: 'Group',
                  name: 'not-tools',
                  namespace: 'default',
                },
              },
            ],
          },
        ] as Entity[],
      }),
    getLocationByEntity: () =>
      Promise.resolve({ id: 'id', type: 'github', target: 'url' }),
    getEntityByName: async entityName => {
      return {
        apiVersion: 'backstage.io/v1alpha1',
        kind: 'User',
        metadata: { name: entityName.name },
        relations: [
          {
            type: RELATION_MEMBER_OF,
            target: { namespace: 'default', kind: 'Group', name: 'tools' },
          },
        ],
      };
    },
  };
  const testProfile: Partial<ProfileInfo> = {
    displayName: 'Display Name',
  };
  const identityApi: Partial<IdentityApi> = {
    getUserId: () => 'tools@example.com',
    getProfile: () => testProfile,
  };

  const renderWrapped = (children: React.ReactNode) =>
    renderWithEffects(
      wrapInTestApp(
        <ApiProvider
          apis={ApiRegistry.from([
            [catalogApiRef, catalogApi],
            [identityApiRef, identityApi],
            [storageApiRef, MockStorageApi.create()],
          ])}
        >
          {children}
        </ApiProvider>,
        {
          mountedRoutes: {
            '/create': createComponentRouteRef,
          },
        },
      ),
    );

  // this test right now causes some red lines in the log output when running tests
  // related to some theme issues in mui-table
  // https://github.com/mbrn/material-table/issues/1293
  it('should render', async () => {
    const { getByText, getByTestId } = await renderWrapped(<CatalogPage />);
    expect(getByText(/Owned \(1\)/)).toBeInTheDocument();
    fireEvent.click(getByTestId('user-picker-all'));
    expect(getByText(/All \(2\)/)).toBeInTheDocument();
  });
  it('should set initial filter correctly', async () => {
    const { getByText } = await renderWrapped(
      <CatalogPage initiallySelectedFilter="all" />,
    );
    expect(getByText(/All \(2\)/)).toBeInTheDocument();
  });
  // this test is for fixing the bug after favoriting an entity, the matching entities defaulting
  // to "owned" filter and not based on the selected filter
  it('should render the correct entities filtered on the selectedfilter', async () => {
    const { getByText, findAllByTitle, getByTestId } = await renderWrapped(
      <CatalogPage />,
    );
    expect(getByText(/Owned \(1\)/)).toBeInTheDocument();
    expect(getByText(/Starred/)).toBeInTheDocument();
    fireEvent.click(getByTestId('user-picker-starred'));
    expect(getByText(/Starred \(0\)/)).toBeInTheDocument();
    fireEvent.click(getByTestId('user-picker-all'));
    expect(getByText(/All \(2\)/)).toBeInTheDocument();

    const starredIcons = await findAllByTitle('Add to favorites');
    fireEvent.click(starredIcons[0]);
    expect(getByText(/All \(2\)/)).toBeInTheDocument();

    fireEvent.click(getByTestId('user-picker-starred'));
    waitFor(() => expect(getByText(/Starred \(1\)/)).toBeInTheDocument());
  });
});

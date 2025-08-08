import React, { useState, useEffect } from 'react';
import { readGraphql, type ResultOf, type VariablesOf } from './graphql/operations/read-graphql';
import { UserCard, UserCardFragment } from './UserCard';
import { TypedReadClient } from './TypedReadClient';

// Query using the UserCard fragment
const USER_LIST_QUERY = readGraphql(`
  query UserListComponent($limit: Int = 20, $offset: Int = 0) {
    listUsers(limit: $limit, offset: $offset) {
      users {
        ...UserCard
      }
      total
      hasMore
    }
  }
`, [UserCardFragment]);

type UserListData = ResultOf<typeof USER_LIST_QUERY>;

interface UserListProps {
  onUserEdit?: (id: string) => void;
  onUserDelete?: (id: string) => void;
}

export function UserList({ onUserEdit, onUserDelete }: UserListProps) {
  const [data, setData] = useState<UserListData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [page, setPage] = useState(0);
  const pageSize = 10;

  useEffect(() => {
    fetchUsers();
  }, [page]);

  const fetchUsers = async () => {
    setLoading(true);
    setError(null);

    try {
      const client = new TypedReadClient('/graphql');
      const response = await fetch('/graphql', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          query: USER_LIST_QUERY,
          variables: {
            limit: pageSize,
            offset: page * pageSize,
          },
        }),
      });

      const result = await response.json();
      
      if (result.errors) {
        throw new Error(result.errors[0].message);
      }

      setData(result.data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to fetch users');
    } finally {
      setLoading(false);
    }
  };

  if (loading && !data) {
    return <div className="loading">Loading users...</div>;
  }

  if (error) {
    return (
      <div className="error">
        <p>Error: {error}</p>
        <button onClick={fetchUsers}>Retry</button>
      </div>
    );
  }

  if (!data) {
    return <div>No data available</div>;
  }

  const { users, total, hasMore } = data.listUsers;
  const totalPages = Math.ceil(total / pageSize);

  return (
    <div className="user-list">
      <div className="user-list__header">
        <h2>Users ({total})</h2>
        <button className="btn btn--primary" onClick={fetchUsers}>
          Refresh
        </button>
      </div>

      <div className="user-list__grid">
        {users.map((user, index) => (
          <UserCard
            key={`user-${index}`}
            user={user}
            onEdit={onUserEdit}
            onDelete={onUserDelete}
          />
        ))}
      </div>

      {users.length === 0 && (
        <div className="user-list__empty">
          <p>No users found</p>
        </div>
      )}

      <div className="user-list__pagination">
        <button
          className="btn"
          disabled={page === 0}
          onClick={() => setPage(p => p - 1)}
        >
          Previous
        </button>
        
        <span className="page-info">
          Page {page + 1} of {totalPages}
        </span>
        
        <button
          className="btn"
          disabled={!hasMore}
          onClick={() => setPage(p => p + 1)}
        >
          Next
        </button>
      </div>
    </div>
  );
}
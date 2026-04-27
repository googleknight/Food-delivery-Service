import React from 'react';
import Layout from '@theme/Layout';
import useBaseUrl from '@docusaurus/useBaseUrl';

export default function ApiReference() {
  const apiUrl = useBaseUrl('/api.html', { absolute: true });
  return (
    <Layout title="API Reference" description="Food Delivery API Documentation">
      <iframe src={apiUrl} style={{ width: '100%', height: 'calc(100vh - 60px)', border: 'none' }} />
    </Layout>
  );
}

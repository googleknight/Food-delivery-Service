import type {ReactNode} from 'react';
import clsx from 'clsx';
import Heading from '@theme/Heading';
import styles from './styles.module.css';

type FeatureItem = {
  title: string;
  imageSrc: string;
  description: ReactNode;
  link: string;
};

const FeatureList: FeatureItem[] = [
  {
    title: 'API Reference',
    imageSrc: require('@site/static/img/logo.png').default,
    description: (
      <>
        Comprehensive OpenAPI 3.0 documentation for all endpoints,
        including request/response schemas and authentication details.
      </>
    ),
    link: '/api',
  },
  {
    title: 'Postman Collections',
    imageSrc: require('@site/static/img/logo.png').default,
    description: (
      <>
        Downloadable Postman collections and environments to get you
        started with testing the API in seconds.
      </>
    ),
    link: '/docs/api-testing',
  },
  {
    title: 'Architecture & Decisions',
    imageSrc: require('@site/static/img/logo.png').default,
    description: (
      <>
        In-depth technical specifications and key architectural decisions
        documented for full transparency.
      </>
    ),
    link: '/docs/key-decisions',
  },
];

function Feature({title, imageSrc, description, link}: FeatureItem) {
  return (
    <div className={clsx('col col--4')}>
      <div className="text--center">
        <a href={link} style={{ display: 'inline-block' }}>
          <img src={imageSrc} className={styles.featureSvg} alt={title} />
        </a>
      </div>
      <div className="text--center padding-horiz--md">
        <Heading as="h3">
          <a href={link} style={{ color: 'inherit', textDecoration: 'none' }}>
            {title}
          </a>
        </Heading>
        <p>{description}</p>
      </div>
    </div>
  );
}

export default function HomepageFeatures(): ReactNode {
  return (
    <section className={styles.features}>
      <div className="container">
        <div className="row">
          {FeatureList.map((props, idx) => (
            <Feature key={idx} {...props} />
          ))}
        </div>
      </div>
    </section>
  );
}

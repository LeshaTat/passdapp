import styles from './funcPanel.module.css'

export default function FuncPanel(props: {children: React.ReactNode}) {
  return <div className={styles.funcPanel}>
    {props.children}
  </div>
}